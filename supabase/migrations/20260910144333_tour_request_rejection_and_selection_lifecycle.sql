-- Complete the traveler rejection/selection lifecycle on top of controlled dispatch.
-- Explicit rejection is distinct from losing a request because another provider was selected.

CREATE OR REPLACE FUNCTION public.reject_trip_proposal(proposal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id uuid;
  v_guide_id uuid;
  v_slot_round integer;
  v_request public.trip_requests%ROWTYPE;
  v_count integer;
  v_max integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Read identifiers first, then always lock the parent request before mutating
  -- lifecycle state. Proposal creation/selection use the same request lock.
  SELECT s.trip_request_id, s.guide_id, s.proposal_round
  INTO v_request_id, v_guide_id, v_slot_round
  FROM public.trip_slots s
  WHERE s.id = proposal_id;

  IF v_request_id IS NULL OR v_guide_id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests r
  WHERE r.id = v_request_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_request.user_id <> (SELECT auth.uid())
     OR v_slot_round <> v_request.proposal_round THEN
    RAISE EXCEPTION 'Not authorized to reject this proposal';
  END IF;

  UPDATE public.trip_slots
  SET status = 'rejected'
  WHERE id = proposal_id
    AND trip_request_id = v_request_id
    AND guide_id = v_guide_id
    AND proposal_round = v_request.proposal_round
    AND status NOT IN ('rejected','finalized','selected','closed');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This proposal can no longer be rejected';
  END IF;

  -- Preserve why this provider left the active audience. It also prevents the
  -- same provider from being randomly invited again in the same round.
  UPDATE public.trip_request_dispatches
  SET status = 'declined', updated_at = now()
  WHERE trip_request_id = v_request_id
    AND provider_id = v_guide_id
    AND proposal_round = v_request.proposal_round
    AND status = 'responded';

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (
    v_guide_id,
    'proposal_rejected',
    'The traveler rejected your proposal for this trip request.',
    v_request_id
  );

  -- A direct-profile request stops being exclusive as soon as the traveler
  -- rejects the targeted provider's proposal. Continue through the same
  -- controlled marketplace dispatch instead of waiting for the old deadline.
  IF v_request.request_channel = 'direct_profile'
     AND v_request.direct_escalated_at IS NULL THEN
    UPDATE public.trip_requests
    SET direct_escalated_at = now(),
        direct_response_deadline = LEAST(COALESCE(direct_response_deadline, now()), now()),
        escalation_notified_provider_ids = '{}'::uuid[],
        max_proposals = 5,
        status = 'active',
        updated_at = now()
    WHERE id = v_request_id;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.trip_slots
  WHERE trip_request_id = v_request_id
    AND proposal_round = v_request.proposal_round
    AND status <> 'rejected';

  SELECT COALESCE(max_proposals, 5) INTO v_max
  FROM public.trip_requests
  WHERE id = v_request_id;

  UPDATE public.trip_requests
  SET proposals_count = v_count,
      status = CASE
        WHEN status = 'proposals_ready' AND v_count < v_max THEN 'active'
        ELSE status
      END,
      updated_at = now()
  WHERE id = v_request_id;

  -- Refill only the audience capacity freed by the rejected provider. Existing
  -- dispatch rows make selection random, idempotent and non-repeating.
  PERFORM public.dispatch_trip_request(v_request_id);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_trip_proposal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_trip_proposal(uuid) TO authenticated;

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

  IF v_request.expires_at IS NOT NULL AND v_request.expires_at <= now() THEN
    RAISE EXCEPTION 'This trip request has expired';
  END IF;

  SELECT id INTO v_winner_slot
  FROM public.trip_slots
  WHERE trip_request_id = v_request_id
    AND guide_id = v_selected_guide_id
    AND proposal_round = v_request.proposal_round
    AND status IN ('accepted','chatting')
  FOR UPDATE;

  IF v_winner_slot IS NULL THEN
    RAISE EXCEPTION 'Selected guide does not have an active proposal for this request';
  END IF;

  -- Notify every provider who was still in this request's live audience exactly
  -- once, whether they had already proposed or were only still considering it.
  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  SELECT loser.provider_id,
         'request_filled',
         'This trip request expired for you because the traveler selected another guide or agency.',
         v_request_id
  FROM (
    SELECT s.guide_id AS provider_id
    FROM public.trip_slots s
    WHERE s.trip_request_id = v_request_id
      AND s.proposal_round = v_request.proposal_round
      AND s.guide_id <> v_selected_guide_id
      AND s.status IN ('accepted','chatting')
    UNION
    SELECT d.provider_id
    FROM public.trip_request_dispatches d
    WHERE d.trip_request_id = v_request_id
      AND d.proposal_round = v_request.proposal_round
      AND d.provider_id <> v_selected_guide_id
      AND d.status IN ('pending','responded')
  ) AS loser;

  UPDATE public.trip_slots
  SET status = 'rejected'
  WHERE trip_request_id = v_request_id
    AND proposal_round = v_request.proposal_round
    AND guide_id <> v_selected_guide_id
    AND status IN ('accepted','chatting');

  -- The dispatch ledger is the authoritative reason an unanswered request is
  -- still visible to a provider. Mark every losing live invitation as expired
  -- so the UI can keep it as a disabled, grey historical card.
  UPDATE public.trip_request_dispatches
  SET status = 'expired', updated_at = now()
  WHERE trip_request_id = v_request_id
    AND proposal_round = v_request.proposal_round
    AND provider_id <> v_selected_guide_id
    AND status IN ('pending','responded');

  UPDATE public.trip_slots
  SET status = 'selected'
  WHERE id = v_winner_slot;

  UPDATE public.trip_requests
  SET status = 'confirmed',
      selected_guide_id = v_selected_guide_id,
      proposals_count = 1,
      updated_at = now()
  WHERE id = v_request_id;

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

NOTIFY pgrst, 'reload schema';