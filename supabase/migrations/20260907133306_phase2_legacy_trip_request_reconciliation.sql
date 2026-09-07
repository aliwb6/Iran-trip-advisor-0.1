-- Phase 2B: reconcile legacy trip-request UI concepts with canonical schema.

ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS budget_tier text,
  ADD COLUMN IF NOT EXISTS rebroadcast_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.trip_requests
  DROP CONSTRAINT IF EXISTS trip_requests_budget_tier_check;
ALTER TABLE public.trip_requests
  ADD CONSTRAINT trip_requests_budget_tier_check
  CHECK (budget_tier IS NULL OR budget_tier IN ('Budget','Mid-range','Luxury'));

ALTER TABLE public.trip_requests
  DROP CONSTRAINT IF EXISTS trip_requests_rebroadcast_count_check;
ALTER TABLE public.trip_requests
  ADD CONSTRAINT trip_requests_rebroadcast_count_check
  CHECK (rebroadcast_count >= 0);

COMMENT ON COLUMN public.trip_requests.budget_tier IS
  'Traveler-facing categorical budget preference used by the current request form.';
COMMENT ON COLUMN public.trip_requests.rebroadcast_count IS
  'Number of times an expired request has been explicitly reopened by its owner.';

CREATE OR REPLACE FUNCTION public.rebroadcast_trip_request(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_dest_text text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.user_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to rebroadcast this request';
  END IF;

  IF v_request.status <> 'expired' THEN
    RAISE EXCEPTION 'Only expired trip requests can be rebroadcast';
  END IF;

  UPDATE public.trip_slots
  SET status = 'rejected'
  WHERE trip_request_id = request_id
    AND status NOT IN ('selected','finalized','closed','rejected');

  UPDATE public.trip_requests
  SET status = 'active',
      proposals_count = 0,
      selected_guide_id = NULL,
      expires_at = now() + interval '7 days',
      rebroadcast_count = rebroadcast_count + 1,
      updated_at = now()
  WHERE id = request_id;

  v_dest_text := COALESCE(array_to_string(v_request.destination, ', '), 'Iran');

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  SELECT p.id,
         'tour_request',
         'A reopened trip request may match your services: ' || v_dest_text,
         request_id
  FROM public.profiles p
  WHERE p.role IN ('guide','agency')
    AND p.is_approved IS TRUE
    AND p.is_rejected IS NOT TRUE
    AND p.is_published IS TRUE
    AND p.accept_bookings IS TRUE
    AND (
      v_request.destination IS NULL
      OR p.city = ANY(v_request.destination)
      OR p.primary_city = ANY(v_request.destination)
    );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rebroadcast_trip_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebroadcast_trip_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guide_reject_trip_slot(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slot_id uuid;
  v_count integer;
  v_max integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id INTO v_slot_id
  FROM public.trip_slots
  WHERE trip_request_id = request_id
    AND guide_id = (SELECT auth.uid())
    AND status NOT IN ('rejected','selected','finalized','closed')
  FOR UPDATE;

  IF v_slot_id IS NULL THEN
    RAISE EXCEPTION 'No rejectable proposal found for this request';
  END IF;

  UPDATE public.trip_slots
  SET status = 'rejected'
  WHERE id = v_slot_id;

  SELECT COUNT(*) INTO v_count
  FROM public.trip_slots
  WHERE trip_request_id = request_id
    AND status <> 'rejected';

  SELECT COALESCE(max_proposals, 5) INTO v_max
  FROM public.trip_requests
  WHERE id = request_id
  FOR UPDATE;

  UPDATE public.trip_requests
  SET proposals_count = v_count,
      status = CASE
        WHEN status = 'proposals_ready' AND v_count < v_max THEN 'active'
        ELSE status
      END,
      updated_at = now()
  WHERE id = request_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.guide_reject_trip_slot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guide_reject_trip_slot(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_selected_trip_slot(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slot_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT s.id INTO v_slot_id
  FROM public.trip_slots s
  JOIN public.trip_requests r ON r.id = s.trip_request_id
  WHERE s.trip_request_id = request_id
    AND s.guide_id = (SELECT auth.uid())
    AND s.status = 'selected'
    AND r.status = 'confirmed'
    AND r.selected_guide_id = (SELECT auth.uid())
  FOR UPDATE OF s;

  IF v_slot_id IS NULL THEN
    RAISE EXCEPTION 'Only the selected guide can finalize a confirmed request';
  END IF;

  UPDATE public.trip_slots
  SET status = 'finalized', finalized_at = now()
  WHERE id = v_slot_id;

  UPDATE public.trip_requests
  SET status = 'completed', updated_at = now()
  WHERE id = request_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_selected_trip_slot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_selected_trip_slot(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';