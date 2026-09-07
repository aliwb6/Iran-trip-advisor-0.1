-- Phase 2D: enforce automatic trip-request expiration and make overdue requests
-- immediately non-actionable even between cron runs.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Prevent proposal submission after the deadline, even if the expiration cron has
-- not yet transitioned the request status.
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

  IF v_request.expires_at IS NOT NULL AND v_request.expires_at <= now() THEN
    RAISE EXCEPTION 'This trip request has expired';
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

-- Automatic expiration worker. Open request states expire when their deadline is
-- reached. Current-round active proposals are closed (not rejected) and both the
-- traveler and affected providers are notified once because the request state
-- transition prevents repeat processing.
CREATE OR REPLACE FUNCTION public.expire_trip_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request record;
  v_dest_text text;
  v_expired_count integer := 0;
BEGIN
  FOR v_request IN
    SELECT r.id, r.user_id, r.destination, r.proposal_round
    FROM public.trip_requests r
    WHERE r.expires_at IS NOT NULL
      AND r.expires_at <= now()
      AND r.status IN ('active','pending','open','proposals_ready')
      AND NOT EXISTS (
        SELECT 1
        FROM public.trip_slots s
        WHERE s.trip_request_id = r.id
          AND s.proposal_round = r.proposal_round
          AND s.status IN ('selected','finalized')
      )
    FOR UPDATE OF r SKIP LOCKED
  LOOP
    v_dest_text := COALESCE(array_to_string(v_request.destination, ', '), 'Iran');

    INSERT INTO public.notifications (user_id, type, message, related_request_id)
    SELECT s.guide_id,
           'request_expired',
           'A trip request you proposed for has expired before a guide was selected.',
           v_request.id
    FROM public.trip_slots s
    WHERE s.trip_request_id = v_request.id
      AND s.proposal_round = v_request.proposal_round
      AND s.status IN ('accepted','chatting')
      AND s.guide_id IS NOT NULL;

    UPDATE public.trip_slots
    SET status = 'closed'
    WHERE trip_request_id = v_request.id
      AND proposal_round = v_request.proposal_round
      AND status IN ('accepted','chatting');

    UPDATE public.trip_requests
    SET status = 'expired',
        updated_at = now()
    WHERE id = v_request.id
      AND status IN ('active','pending','open','proposals_ready');

    IF FOUND THEN
      INSERT INTO public.notifications (user_id, type, message, related_request_id)
      VALUES (
        v_request.user_id,
        'request_expired',
        'Your trip request to ' || v_dest_text || ' expired. You can rebroadcast it to start a new proposal round.',
        v_request.id
      );
      v_expired_count := v_expired_count + 1;
    END IF;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_trip_requests() FROM PUBLIC, anon, authenticated;

-- Guide selection must also respect the deadline in the small window between the
-- deadline and the next expiration cron run.
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

  IF v_request.expires_at IS NOT NULL AND v_request.expires_at <= now() THEN
    RAISE EXCEPTION 'This trip request has expired';
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

-- Rebroadcast may be requested immediately once the deadline has passed; the user
-- does not have to wait for the cron worker to flip status to expired first.
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
    IF v_request.status NOT IN ('active','pending','open','proposals_ready')
       OR v_request.expires_at IS NULL
       OR v_request.expires_at > now() THEN
      RAISE EXCEPTION 'Only expired trip requests can be rebroadcast';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.trip_slots s
    WHERE s.trip_request_id = request_id
      AND s.proposal_round = v_request.proposal_round
      AND s.status IN ('selected','finalized')
  ) THEN
    RAISE EXCEPTION 'A request with a selected or finalized guide cannot be rebroadcast';
  END IF;

  UPDATE public.trip_slots
  SET status = 'closed'
  WHERE trip_request_id = request_id
    AND proposal_round = v_request.proposal_round
    AND status IN ('accepted','chatting');

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

-- Backfill stale historical open requests without sending months-late notifications.
UPDATE public.trip_slots s
SET status = 'closed'
FROM public.trip_requests r
WHERE s.trip_request_id = r.id
  AND s.proposal_round = r.proposal_round
  AND s.status IN ('accepted','chatting')
  AND r.expires_at IS NOT NULL
  AND r.expires_at <= now()
  AND r.status IN ('active','pending','open','proposals_ready');

UPDATE public.trip_requests
SET status = 'expired',
    updated_at = now()
WHERE expires_at IS NOT NULL
  AND expires_at <= now()
  AND status IN ('active','pending','open','proposals_ready')
  AND NOT EXISTS (
    SELECT 1
    FROM public.trip_slots s
    WHERE s.trip_request_id = trip_requests.id
      AND s.proposal_round = trip_requests.proposal_round
      AND s.status IN ('selected','finalized')
  );

-- Idempotently keep a single scheduler job. Runs every 15 minutes.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'expire-trip-requests'
  ORDER BY jobid DESC
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;

SELECT cron.schedule(
  'expire-trip-requests',
  '*/15 * * * *',
  'SELECT public.expire_trip_requests();'
);

NOTIFY pgrst, 'reload schema';