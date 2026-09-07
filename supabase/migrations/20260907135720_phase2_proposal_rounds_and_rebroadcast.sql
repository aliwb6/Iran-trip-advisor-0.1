-- Phase 2C: make rebroadcasts explicit proposal rounds so providers can re-apply
-- without losing historical proposal rows.

ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS proposal_round integer NOT NULL DEFAULT 1;

ALTER TABLE public.trip_slots
  ADD COLUMN IF NOT EXISTS proposal_round integer NOT NULL DEFAULT 1;

ALTER TABLE public.trip_requests
  DROP CONSTRAINT IF EXISTS trip_requests_proposal_round_check;
ALTER TABLE public.trip_requests
  ADD CONSTRAINT trip_requests_proposal_round_check
  CHECK (proposal_round >= 1);

ALTER TABLE public.trip_slots
  DROP CONSTRAINT IF EXISTS trip_slots_proposal_round_check;
ALTER TABLE public.trip_slots
  ADD CONSTRAINT trip_slots_proposal_round_check
  CHECK (proposal_round >= 1);

COMMENT ON COLUMN public.trip_requests.proposal_round IS
  'Current proposal cycle. Incremented each time an expired request is rebroadcast.';
COMMENT ON COLUMN public.trip_slots.proposal_round IS
  'Proposal cycle in which this provider submitted the proposal.';

-- Replace the old one-proposal-ever uniqueness with one proposal per provider per round.
ALTER TABLE public.trip_slots
  DROP CONSTRAINT IF EXISTS trip_slots_request_guide_unique;
ALTER TABLE public.trip_slots
  DROP CONSTRAINT IF EXISTS trip_slots_trip_request_id_guide_id_key;
ALTER TABLE public.trip_slots
  DROP CONSTRAINT IF EXISTS trip_slots_request_guide_round_unique;
ALTER TABLE public.trip_slots
  ADD CONSTRAINT trip_slots_request_guide_round_unique
  UNIQUE (trip_request_id, guide_id, proposal_round);

CREATE INDEX IF NOT EXISTS idx_trip_slots_request_round
  ON public.trip_slots(trip_request_id, proposal_round);

-- Every new proposal is attached to the request's current round and the cap is
-- enforced only within that round.
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

  NEW.proposal_round := v_request.proposal_round;

  SELECT COUNT(*) INTO v_active_count
  FROM public.trip_slots s
  WHERE s.trip_request_id = NEW.trip_request_id
    AND s.proposal_round = v_request.proposal_round
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

-- proposals_count and proposals_ready now describe only the current round.
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
    AND proposal_round = v_req.proposal_round
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

CREATE OR REPLACE FUNCTION public.reject_trip_proposal(proposal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id uuid;
  v_round integer;
  v_count integer;
  v_max integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT s.trip_request_id, r.proposal_round
  INTO v_request_id, v_round
  FROM public.trip_slots s
  JOIN public.trip_requests r ON r.id = s.trip_request_id
  WHERE s.id = proposal_id
    AND r.user_id = (SELECT auth.uid())
    AND s.proposal_round = r.proposal_round
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
    AND proposal_round = v_round
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

CREATE OR REPLACE FUNCTION public.guide_reject_trip_slot(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slot_id uuid;
  v_round integer;
  v_count integer;
  v_max integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT s.id, r.proposal_round
  INTO v_slot_id, v_round
  FROM public.trip_slots s
  JOIN public.trip_requests r ON r.id = s.trip_request_id
  WHERE s.trip_request_id = request_id
    AND s.guide_id = (SELECT auth.uid())
    AND s.proposal_round = r.proposal_round
    AND s.status NOT IN ('rejected','selected','finalized','closed')
  FOR UPDATE OF s;

  IF v_slot_id IS NULL THEN
    RAISE EXCEPTION 'No rejectable proposal found for this request';
  END IF;

  UPDATE public.trip_slots
  SET status = 'rejected'
  WHERE id = v_slot_id;

  SELECT COUNT(*) INTO v_count
  FROM public.trip_slots
  WHERE trip_request_id = request_id
    AND proposal_round = v_round
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

-- Rebroadcast advances the round. Old proposal rows remain as history while all
-- eligible providers, including providers from older rounds, may submit again.
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
    AND proposal_round = v_request.proposal_round
    AND status NOT IN ('selected','finalized','closed','rejected');

  UPDATE public.trip_requests
  SET status = 'active',
      proposals_count = 0,
      selected_guide_id = NULL,
      expires_at = now() + interval '7 days',
      rebroadcast_count = rebroadcast_count + 1,
      proposal_round = proposal_round + 1,
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

-- Selection is scoped to the current round and uses local aliases to avoid
-- ambiguity between RPC argument names and columns.
CREATE OR REPLACE FUNCTION public.select_trip_guide(request_id uuid, selected_guide_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id uuid := request_id;
  v_selected_guide_id uuid := selected_guide_id;
  v_request public.trip_requests%ROWTYPE;
  v_winner_slot uuid;
  v_loser record;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = v_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.user_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to select a guide for this request';
  END IF;

  IF v_request.status IN ('confirmed','closed','booked','completed','expired','cancelled') THEN
    RAISE EXCEPTION 'This trip request can no longer change its selected guide';
  END IF;

  SELECT id INTO v_winner_slot
  FROM public.trip_slots
  WHERE trip_request_id = v_request_id
    AND guide_id = v_selected_guide_id
    AND proposal_round = v_request.proposal_round
    AND status NOT IN ('rejected','finalized','closed')
  FOR UPDATE;

  IF v_winner_slot IS NULL THEN
    RAISE EXCEPTION 'Selected guide does not have an active proposal for this request';
  END IF;

  FOR v_loser IN
    SELECT id, guide_id
    FROM public.trip_slots
    WHERE trip_request_id = v_request_id
      AND proposal_round = v_request.proposal_round
      AND guide_id <> v_selected_guide_id
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
      v_request_id
    );
  END LOOP;

  UPDATE public.trip_slots
  SET status = 'selected'
  WHERE id = v_winner_slot;

  UPDATE public.trip_requests tr
  SET status = 'confirmed',
      selected_guide_id = v_selected_guide_id,
      proposals_count = 1,
      updated_at = now()
  WHERE tr.id = v_request_id;

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (
    v_selected_guide_id,
    'guide_selected',
    'Congratulations! A traveler selected you for their trip request.',
    v_request_id
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.select_trip_guide(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_trip_guide(uuid, uuid) TO authenticated;

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
    AND s.proposal_round = r.proposal_round
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