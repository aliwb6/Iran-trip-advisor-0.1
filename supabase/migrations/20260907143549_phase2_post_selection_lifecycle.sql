-- Phase 2: canonical post-selection lifecycle
-- confirmed -> booked -> completed / cancelled

CREATE OR REPLACE FUNCTION public.finalize_selected_trip_slot(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_slot_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip request not found';
  END IF;

  IF v_request.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed trip requests can be booked';
  END IF;

  IF v_request.selected_guide_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Only the selected guide or agency can confirm this booking';
  END IF;

  SELECT s.id INTO v_slot_id
  FROM public.trip_slots s
  WHERE s.trip_request_id = request_id
    AND s.guide_id = (SELECT auth.uid())
    AND s.proposal_round = v_request.proposal_round
    AND s.status = 'selected'
  FOR UPDATE;

  IF v_slot_id IS NULL THEN
    RAISE EXCEPTION 'No selected proposal was found for this booking';
  END IF;

  UPDATE public.trip_slots
  SET status = 'finalized',
      finalized_at = COALESCE(finalized_at, now())
  WHERE id = v_slot_id;

  UPDATE public.trip_requests
  SET status = 'booked',
      updated_at = now()
  WHERE id = request_id;

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (
    v_request.user_id,
    'trip_booked',
    'Your selected guide or agency confirmed the trip. Your request is now booked.',
    request_id
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_trip_request(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_request public.trip_requests%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.user_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Only the traveler who created this request can complete it';
  END IF;

  IF v_request.status <> 'booked' THEN
    RAISE EXCEPTION 'Only booked trip requests can be completed';
  END IF;

  IF v_request.end_date IS NOT NULL AND v_request.end_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'This trip cannot be completed before its end date';
  END IF;

  IF v_request.selected_guide_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.trip_slots s
    WHERE s.trip_request_id = request_id
      AND s.guide_id = v_request.selected_guide_id
      AND s.proposal_round = v_request.proposal_round
      AND s.status = 'finalized'
  ) THEN
    RAISE EXCEPTION 'The selected booking has not been finalized';
  END IF;

  UPDATE public.trip_requests
  SET status = 'completed',
      updated_at = now()
  WHERE id = request_id;

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (
    v_request.selected_guide_id,
    'trip_completed',
    'The traveler marked your booked trip as completed.',
    request_id
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_trip_request(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_request public.trip_requests%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.user_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Only the traveler who created this request can cancel it';
  END IF;

  IF v_request.status IN ('completed','cancelled','expired','closed') THEN
    RAISE EXCEPTION 'This trip request can no longer be cancelled';
  END IF;

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  SELECT DISTINCT s.guide_id,
         'request_cancelled',
         'A trip request you proposed for was cancelled by the traveler.',
         request_id
  FROM public.trip_slots s
  WHERE s.trip_request_id = request_id
    AND s.proposal_round = v_request.proposal_round
    AND s.guide_id IS NOT NULL
    AND s.status IN ('accepted','chatting','selected','finalized');

  UPDATE public.trip_slots
  SET status = 'closed'
  WHERE trip_request_id = request_id
    AND proposal_round = v_request.proposal_round
    AND status IN ('accepted','chatting','selected');

  UPDATE public.trip_requests
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = request_id;

  RETURN true;
END;
$function$;

UPDATE public.trip_slots s
SET status = 'finalized'
FROM public.trip_requests r
WHERE r.id = s.trip_request_id
  AND r.status = 'booked'
  AND r.selected_guide_id = s.guide_id
  AND r.proposal_round = s.proposal_round
  AND s.status = 'selected'
  AND s.finalized_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_trip_request_lifecycle_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF current_user IN ('anon','authenticated') AND (
    NEW.user_id IS DISTINCT FROM OLD.user_id OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.selected_guide_id IS DISTINCT FROM OLD.selected_guide_id OR
    NEW.proposals_count IS DISTINCT FROM OLD.proposals_count OR
    NEW.proposal_round IS DISTINCT FROM OLD.proposal_round OR
    NEW.rebroadcast_count IS DISTINCT FROM OLD.rebroadcast_count OR
    NEW.expires_at IS DISTINCT FROM OLD.expires_at
  ) THEN
    RAISE EXCEPTION 'Lifecycle fields must be changed through the canonical trip request RPCs';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_trip_request_lifecycle_fields ON public.trip_requests;
CREATE TRIGGER trg_protect_trip_request_lifecycle_fields
BEFORE UPDATE ON public.trip_requests
FOR EACH ROW
EXECUTE FUNCTION public.protect_trip_request_lifecycle_fields();

CREATE OR REPLACE FUNCTION public.protect_trip_slot_lifecycle_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF current_user IN ('anon','authenticated') AND (
    NEW.trip_request_id IS DISTINCT FROM OLD.trip_request_id OR
    NEW.guide_id IS DISTINCT FROM OLD.guide_id OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.proposal_round IS DISTINCT FROM OLD.proposal_round OR
    NEW.accepted_at IS DISTINCT FROM OLD.accepted_at OR
    NEW.finalized_at IS DISTINCT FROM OLD.finalized_at
  ) THEN
    RAISE EXCEPTION 'Proposal lifecycle fields must be changed through the canonical trip request RPCs';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_trip_slot_lifecycle_fields ON public.trip_slots;
CREATE TRIGGER trg_protect_trip_slot_lifecycle_fields
BEFORE UPDATE ON public.trip_slots
FOR EACH ROW
EXECUTE FUNCTION public.protect_trip_slot_lifecycle_fields();

CREATE OR REPLACE FUNCTION public.protect_trip_slot_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'Trip proposals are retained for lifecycle history and cannot be deleted directly';
  END IF;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_trip_slot_delete ON public.trip_slots;
CREATE TRIGGER trg_protect_trip_slot_delete
BEFORE DELETE ON public.trip_slots
FOR EACH ROW
EXECUTE FUNCTION public.protect_trip_slot_delete();

REVOKE ALL ON FUNCTION public.finalize_selected_trip_slot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_trip_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_trip_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_selected_trip_slot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_trip_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_trip_request(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';