-- Phase 2: canonicalize trip-request proposal lifecycle and guide selection.

-- A) Validate/cap proposal inserts transactionally.
CREATE OR REPLACE FUNCTION public.validate_trip_slot_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_active_count integer;
  v_max integer;
BEGIN
  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = NEW.trip_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip request not found';
  END IF;

  IF v_request.status NOT IN ('active','pending','open') THEN
    RAISE EXCEPTION 'This trip request is not accepting proposals';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.guide_id
      AND p.role IN ('guide','agency')
      AND p.is_approved IS TRUE
      AND p.is_rejected IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Guide or agency is not eligible to submit proposals';
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.trip_slots s
  WHERE s.trip_request_id = NEW.trip_request_id
    AND s.status <> 'rejected';

  v_max := COALESCE(v_request.max_proposals, 5);

  IF v_active_count >= v_max THEN
    RAISE EXCEPTION 'This trip request has reached its proposal limit';
  END IF;

  NEW.status := 'accepted';
  NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_trip_slot_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_trip_slot_insert ON public.trip_slots;
CREATE TRIGGER trg_validate_trip_slot_insert
  BEFORE INSERT ON public.trip_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_trip_slot_insert();

-- B) Keep proposals_count accurate and notify the tourist exactly once when cap is reached.
CREATE OR REPLACE FUNCTION public.handle_trip_slot_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_req public.trip_requests%ROWTYPE;
  v_max integer;
  v_dest_text text;
  v_marked_ready boolean := false;
BEGIN
  SELECT * INTO v_req
  FROM public.trip_requests
  WHERE id = NEW.trip_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.trip_slots
  WHERE trip_request_id = NEW.trip_request_id
    AND status <> 'rejected';

  v_max := COALESCE(v_req.max_proposals, 5);

  UPDATE public.trip_requests
  SET proposals_count = v_count,
      status = CASE
        WHEN v_count >= v_max AND status IN ('active','pending','open') THEN 'proposals_ready'
        ELSE status
      END,
      updated_at = now()
  WHERE id = NEW.trip_request_id
  RETURNING (status = 'proposals_ready' AND v_req.status <> 'proposals_ready') INTO v_marked_ready;

  IF v_marked_ready AND v_req.user_id IS NOT NULL THEN
    v_dest_text := COALESCE(array_to_string(v_req.destination, ', '), 'Iran');
    INSERT INTO public.notifications (user_id, type, message, related_request_id)
    VALUES (
      v_req.user_id,
      'proposals_ready',
      v_max || ' guides are ready for your trip to ' || v_dest_text || '! Log in to choose your guide.',
      NEW.trip_request_id
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_trip_slot_insert() FROM PUBLIC, anon, authenticated;

-- C) Rejecting a proposal reopens capacity and keeps count/status consistent.
CREATE OR REPLACE FUNCTION public.reject_trip_proposal(proposal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id uuid;
  v_count integer;
  v_max integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT s.trip_request_id INTO v_request_id
  FROM public.trip_slots s
  JOIN public.trip_requests r ON r.id = s.trip_request_id
  WHERE s.id = proposal_id
    AND r.user_id = (SELECT auth.uid())
    AND s.status NOT IN ('rejected','finalized','selected','closed')
  FOR UPDATE OF s;

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to reject this proposal';
  END IF;

  UPDATE public.trip_slots
  SET status = 'rejected'
  WHERE id = proposal_id;

  SELECT COUNT(*) INTO v_count
  FROM public.trip_slots
  WHERE trip_request_id = v_request_id
    AND status <> 'rejected';

  SELECT COALESCE(max_proposals, 5) INTO v_max
  FROM public.trip_requests
  WHERE id = v_request_id
  FOR UPDATE;

  UPDATE public.trip_requests
  SET proposals_count = v_count,
      status = CASE
        WHEN status = 'proposals_ready' AND v_count < v_max THEN 'active'
        ELSE status
      END,
      updated_at = now()
  WHERE id = v_request_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_trip_proposal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_trip_proposal(uuid) TO authenticated;

-- D) Atomic tourist guide selection. This is the canonical selection path.
CREATE OR REPLACE FUNCTION public.select_trip_guide(request_id uuid, selected_guide_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_winner_slot uuid;
  v_loser record;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.user_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to select a guide for this request';
  END IF;

  IF v_request.status IN ('confirmed','closed','booked','completed','expired','cancelled') THEN
    RAISE EXCEPTION 'This trip request can no longer change its selected guide';
  END IF;

  SELECT id INTO v_winner_slot
  FROM public.trip_slots
  WHERE trip_request_id = request_id
    AND guide_id = selected_guide_id
    AND status NOT IN ('rejected','finalized','closed')
  FOR UPDATE;

  IF v_winner_slot IS NULL THEN
    RAISE EXCEPTION 'Selected guide does not have an active proposal for this request';
  END IF;

  -- Reject all competing proposals and notify each losing provider once.
  FOR v_loser IN
    SELECT id, guide_id
    FROM public.trip_slots
    WHERE trip_request_id = request_id
      AND guide_id <> selected_guide_id
      AND status NOT IN ('rejected','finalized','closed')
    FOR UPDATE
  LOOP
    UPDATE public.trip_slots
    SET status = 'rejected'
    WHERE id = v_loser.id;

    INSERT INTO public.notifications (user_id, type, message, related_request_id)
    VALUES (
      v_loser.guide_id,
      'request_filled',
      'A trip request you proposed for has been filled by another guide or agency.',
      request_id
    );
  END LOOP;

  UPDATE public.trip_slots
  SET status = 'selected'
  WHERE id = v_winner_slot;

  UPDATE public.trip_requests
  SET status = 'confirmed',
      selected_guide_id = selected_guide_id,
      proposals_count = 1,
      updated_at = now()
  WHERE id = request_id;

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (
    selected_guide_id,
    'guide_selected',
    'Congratulations! A traveler selected you for their trip request.',
    request_id
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.select_trip_guide(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_trip_guide(uuid, uuid) TO authenticated;

-- E) Remove the old duplicate selection notification trigger/function path.
DROP TRIGGER IF EXISTS trg_notify_guide_selected ON public.trip_requests;
DROP FUNCTION IF EXISTS public.notify_on_guide_selected();
DROP FUNCTION IF EXISTS public.handle_trip_request_confirmed();

NOTIFY pgrst, 'reload schema';
