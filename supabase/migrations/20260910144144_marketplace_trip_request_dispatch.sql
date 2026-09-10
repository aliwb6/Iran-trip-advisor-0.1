-- Controlled marketplace dispatch.  A proposal cap is not an audience cap: this
-- ledger is the sole record of which providers may discover/respond to a round.

CREATE TABLE IF NOT EXISTS public.trip_request_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_request_id uuid NOT NULL REFERENCES public.trip_requests(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposal_round integer NOT NULL CHECK (proposal_round >= 1),
  batch_number integer NOT NULL DEFAULT 1 CHECK (batch_number >= 1),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'responded', 'declined', 'expired', 'closed')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_request_dispatches_request_provider_round_key
    UNIQUE (trip_request_id, provider_id, proposal_round),
  CONSTRAINT trip_request_dispatches_response_state_check CHECK (
    (status = 'responded') = (responded_at IS NOT NULL) OR status <> 'responded'
  )
);

COMMENT ON TABLE public.trip_request_dispatches IS
  'Server-created marketplace invitations. Pending invitations expire after the configurable 24 hour dispatch window.';

CREATE INDEX IF NOT EXISTS idx_trip_request_dispatches_provider_actionable
  ON public.trip_request_dispatches(provider_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_request_dispatches_request_round
  ON public.trip_request_dispatches(trip_request_id, proposal_round, status);
CREATE INDEX IF NOT EXISTS idx_trip_request_dispatches_pending_expiry
  ON public.trip_request_dispatches(expires_at)
  WHERE status = 'pending';

ALTER TABLE public.trip_request_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trip_request_dispatches FROM anon, authenticated;
CREATE POLICY trip_request_dispatches_select_own
ON public.trip_request_dispatches FOR SELECT TO authenticated
USING (provider_id = (SELECT auth.uid()) OR private.current_user_is_admin());
GRANT SELECT ON public.trip_request_dispatches TO authenticated;

CREATE OR REPLACE FUNCTION private.marketplace_provider_is_eligible(
  p_provider_id uuid,
  p_destination text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_provider_id
      AND p.role IN ('guide', 'agency')
      AND p.is_approved IS TRUE
      AND p.is_rejected IS NOT TRUE
      AND p.is_published IS TRUE
      AND p.accept_bookings IS TRUE
      AND (
        COALESCE(cardinality(p_destination), 0) = 0
        OR p.city = ANY(p_destination)
        OR p.primary_city = ANY(p_destination)
        OR COALESCE(p.other_cities, '{}'::text[]) && p_destination
      )
  );
$$;
REVOKE ALL ON FUNCTION private.marketplace_provider_is_eligible(uuid, text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_trip_request(p_request_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_active integer;
  v_capacity integer;
  v_batch integer;
  v_created integer := 0;
BEGIN
  SELECT * INTO v_request FROM public.trip_requests
  WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND
     OR v_request.status NOT IN ('active', 'pending', 'open')
     OR (v_request.expires_at IS NOT NULL AND v_request.expires_at <= now())
     OR (v_request.request_channel = 'direct_profile' AND v_request.direct_escalated_at IS NULL) THEN
    RETURN 0;
  END IF;

  UPDATE public.trip_request_dispatches
  SET status = 'expired', updated_at = now()
  WHERE trip_request_id = v_request.id
    AND proposal_round = v_request.proposal_round
    AND status = 'pending'
    AND expires_at <= now();

  SELECT count(*) INTO v_active FROM public.trip_request_dispatches
  WHERE trip_request_id = v_request.id
    AND proposal_round = v_request.proposal_round
    AND status = 'pending'
    AND expires_at > now();
  v_capacity := GREATEST(0, 5 - v_active);
  IF v_capacity = 0 THEN RETURN 0; END IF;

  SELECT COALESCE(max(batch_number), 0) + 1 INTO v_batch
  FROM public.trip_request_dispatches
  WHERE trip_request_id = v_request.id AND proposal_round = v_request.proposal_round;

  WITH candidates AS (
    SELECT p.id
    FROM public.profiles p
    WHERE private.marketplace_provider_is_eligible(p.id, v_request.destination)
      AND p.id <> v_request.user_id
      AND (v_request.direct_provider_id IS NULL OR p.id <> v_request.direct_provider_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.trip_request_dispatches d
        WHERE d.trip_request_id = v_request.id
          AND d.provider_id = p.id
          AND d.proposal_round = v_request.proposal_round
      )
    ORDER BY random()
    LIMIT v_capacity
  ), inserted AS (
    INSERT INTO public.trip_request_dispatches (
      trip_request_id, provider_id, proposal_round, batch_number, status, expires_at
    )
    SELECT v_request.id, c.id, v_request.proposal_round, v_batch, 'pending',
           now() + interval '24 hours'
    FROM candidates c
    ON CONFLICT (trip_request_id, provider_id, proposal_round) DO NOTHING
    RETURNING provider_id
  ), notified AS (
    INSERT INTO public.notifications (user_id, type, message, related_request_id)
    SELECT i.provider_id, 'tour_request',
           'You have a new trip request matching your services.', v_request.id
    FROM inserted i
    RETURNING user_id
  )
  SELECT count(*) INTO v_created FROM notified;

  IF v_request.request_channel = 'direct_profile' AND v_request.direct_escalated_at IS NOT NULL THEN
    INSERT INTO public.email_outbox (recipient_user_id, recipient_email, template, payload, unique_key)
    SELECT d.provider_id, p.email, 'trip_request_escalation_invite',
           jsonb_build_object('request_id', v_request.id, 'destination', v_request.destination,
                              'guide_name', p.full_name),
           'trip-request-escalation:' || v_request.id::text || ':' || d.provider_id::text || ':' || v_request.proposal_round::text
    FROM public.trip_request_dispatches d
    JOIN public.profiles p ON p.id = d.provider_id
    WHERE d.trip_request_id = v_request.id AND d.proposal_round = v_request.proposal_round
      AND d.batch_number = v_batch AND p.notify_email IS TRUE
      AND NULLIF(btrim(p.email), '') IS NOT NULL
    ON CONFLICT (unique_key) DO NOTHING;
  END IF;

  RETURN v_created;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_trip_request(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_new_marketplace_trip_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.request_channel IS DISTINCT FROM 'direct_profile' THEN
    PERFORM public.dispatch_trip_request(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_new_marketplace_trip_request() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_new_trip_request ON public.trip_requests;
DROP TRIGGER IF EXISTS trg_notify_guides_new_request ON public.trip_requests;
DROP TRIGGER IF EXISTS trg_dispatch_new_marketplace_trip_request ON public.trip_requests;
CREATE TRIGGER trg_dispatch_new_marketplace_trip_request
AFTER INSERT ON public.trip_requests FOR EACH ROW
EXECUTE FUNCTION public.dispatch_new_marketplace_trip_request();

CREATE OR REPLACE FUNCTION public.notify_guides_new_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_provider public.profiles%ROWTYPE; v_destination text;
BEGIN
  IF NEW.request_channel <> 'direct_profile' OR NEW.direct_provider_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_provider FROM public.profiles WHERE id = NEW.direct_provider_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_destination := COALESCE(array_to_string(NEW.destination, ', '), 'Iran');
  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (v_provider.id, 'direct_trip_request',
          'You have a direct trip request for ' || v_destination || '. Submit your proposal within 12 hours to keep the request exclusive.', NEW.id);
  IF v_provider.notify_email IS TRUE AND NULLIF(btrim(v_provider.email), '') IS NOT NULL THEN
    INSERT INTO public.email_outbox (recipient_user_id, recipient_email, template, payload, unique_key)
    VALUES (v_provider.id, v_provider.email, 'direct_trip_request',
            jsonb_build_object('request_id', NEW.id, 'destination', NEW.destination,
              'deadline', NEW.direct_response_deadline, 'provider_name', v_provider.full_name),
            'direct-trip-request:' || NEW.id::text || ':' || v_provider.id::text)
    ON CONFLICT (unique_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_guides_new_request() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_direct_trip_request ON public.trip_requests;
CREATE TRIGGER trg_notify_direct_trip_request
AFTER INSERT ON public.trip_requests FOR EACH ROW
EXECUTE FUNCTION public.notify_guides_new_request();

CREATE OR REPLACE FUNCTION public.decline_trip_request_invitation(request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_round integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT proposal_round INTO v_round FROM public.trip_requests WHERE id = request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip request not found'; END IF;
  UPDATE public.trip_request_dispatches SET status = 'declined', updated_at = now()
  WHERE trip_request_id = request_id AND provider_id = (SELECT auth.uid())
    AND proposal_round = v_round AND status = 'pending' AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'No active invitation found for this request'; END IF;
  PERFORM public.dispatch_trip_request(request_id);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.decline_trip_request_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_trip_request_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_trip_request_dispatches()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request record; v_processed integer := 0;
BEGIN
  FOR v_request IN
    SELECT r.id FROM public.trip_requests r
    WHERE r.status IN ('active', 'pending', 'open')
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND (r.request_channel IS DISTINCT FROM 'direct_profile' OR r.direct_escalated_at IS NOT NULL)
      AND EXISTS (SELECT 1 FROM public.trip_request_dispatches d WHERE d.trip_request_id = r.id
        AND d.proposal_round = r.proposal_round AND d.status = 'pending' AND d.expires_at <= now())
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.dispatch_trip_request(v_request.id);
    v_processed := v_processed + 1;
  END LOOP;
  RETURN v_processed;
END;
$$;
REVOKE ALL ON FUNCTION public.process_trip_request_dispatches() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_trip_slot_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.trip_requests%ROWTYPE; v_active_count integer; v_max integer;
BEGIN
  SELECT * INTO v_request FROM public.trip_requests WHERE id = NEW.trip_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip request not found'; END IF;
  IF v_request.status NOT IN ('active','pending','open') THEN RAISE EXCEPTION 'This trip request is not accepting proposals'; END IF;
  IF v_request.expires_at IS NOT NULL AND v_request.expires_at <= now() THEN RAISE EXCEPTION 'This trip request has expired'; END IF;
  IF NEW.guide_id <> (SELECT auth.uid()) OR NOT private.marketplace_provider_is_eligible(NEW.guide_id, v_request.destination) THEN
    RAISE EXCEPTION 'Guide or agency is not eligible to submit proposals';
  END IF;
  IF v_request.request_channel = 'direct_profile' AND v_request.direct_escalated_at IS NULL THEN
    IF NEW.guide_id <> v_request.direct_provider_id THEN RAISE EXCEPTION 'This direct trip request is currently private to another provider'; END IF;
    IF v_request.direct_response_deadline IS NOT NULL AND v_request.direct_response_deadline <= now() THEN RAISE EXCEPTION 'The exclusive response window has ended'; END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.trip_request_dispatches d
    WHERE d.trip_request_id = v_request.id AND d.provider_id = NEW.guide_id
      AND d.proposal_round = v_request.proposal_round AND d.status = 'pending' AND d.expires_at > now()
  ) THEN RAISE EXCEPTION 'This trip request was not dispatched to this provider';
  END IF;
  NEW.proposal_round := v_request.proposal_round;
  SELECT count(*) INTO v_active_count FROM public.trip_slots s WHERE s.trip_request_id = v_request.id
    AND s.proposal_round = v_request.proposal_round AND s.status <> 'rejected';
  v_max := COALESCE(v_request.max_proposals, 5);
  IF v_active_count >= v_max THEN RAISE EXCEPTION 'This trip request has reached its proposal limit'; END IF;
  UPDATE public.trip_request_dispatches SET status = 'responded', responded_at = now(), updated_at = now()
  WHERE trip_request_id = v_request.id AND provider_id = NEW.guide_id AND proposal_round = v_request.proposal_round
    AND status = 'pending';
  NEW.status := 'accepted'; NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS trip_requests_authenticated_select ON public.trip_requests;
CREATE POLICY trip_requests_authenticated_select ON public.trip_requests FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid()) OR selected_guide_id = (SELECT auth.uid()) OR private.current_user_is_admin()
  OR (request_channel = 'direct_profile' AND direct_escalated_at IS NULL AND direct_provider_id = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.trip_request_dispatches d WHERE d.trip_request_id = trip_requests.id
    AND d.provider_id = (SELECT auth.uid()) AND d.proposal_round = trip_requests.proposal_round
    AND d.status IN ('pending','responded','declined','expired','closed'))
  OR EXISTS (SELECT 1 FROM public.trip_slots s WHERE s.trip_request_id = trip_requests.id
    AND s.guide_id = (SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION public.rebroadcast_trip_request(request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.trip_requests%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_request FROM public.trip_requests WHERE id = request_id FOR UPDATE;
  IF NOT FOUND OR v_request.user_id <> (SELECT auth.uid()) THEN RAISE EXCEPTION 'Not authorized to rebroadcast this request'; END IF;
  IF v_request.status <> 'expired' AND (v_request.expires_at IS NULL OR v_request.expires_at > now()) THEN RAISE EXCEPTION 'Only expired trip requests can be rebroadcast'; END IF;
  IF EXISTS (SELECT 1 FROM public.trip_slots s WHERE s.trip_request_id = request_id AND s.proposal_round = v_request.proposal_round AND s.status IN ('selected','finalized')) THEN RAISE EXCEPTION 'A request with a selected or finalized guide cannot be rebroadcast'; END IF;
  UPDATE public.trip_slots SET status = 'closed' WHERE trip_request_id = request_id AND proposal_round = v_request.proposal_round AND status IN ('accepted','chatting');
  UPDATE public.trip_request_dispatches SET status = 'closed', updated_at = now() WHERE trip_request_id = request_id AND proposal_round = v_request.proposal_round AND status = 'pending';
  UPDATE public.trip_requests SET status = 'active', proposals_count = 0, selected_guide_id = NULL,
    expires_at = now() + interval '7 days', rebroadcast_count = rebroadcast_count + 1,
    proposal_round = proposal_round + 1, updated_at = now() WHERE id = request_id;
  PERFORM public.dispatch_trip_request(request_id);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.rebroadcast_trip_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebroadcast_trip_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.escalate_stale_direct_trip_requests()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.trip_requests%ROWTYPE; v_count integer := 0;
BEGIN
  FOR v_request IN SELECT r.* FROM public.trip_requests r WHERE r.request_channel = 'direct_profile'
    AND r.direct_provider_id IS NOT NULL AND r.direct_escalated_at IS NULL
    AND r.direct_response_deadline <= now() AND r.status IN ('active','pending','open')
    AND (r.expires_at IS NULL OR r.expires_at > now())
    AND NOT EXISTS (SELECT 1 FROM public.trip_slots s WHERE s.trip_request_id = r.id AND s.proposal_round = r.proposal_round AND s.status <> 'rejected')
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.trip_requests SET direct_escalated_at = now(), escalation_notified_provider_ids = '{}'::uuid[],
      max_proposals = 5, status = 'active', updated_at = now() WHERE id = v_request.id;
    INSERT INTO public.notifications (user_id, type, message, related_request_id) VALUES (v_request.user_id,
      'direct_request_escalated', 'Your selected guide did not respond within 12 hours. Your trip request is now open to other guides.', v_request.id);
    PERFORM public.dispatch_trip_request(v_request.id); v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

DO $$
DECLARE v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM public.trip_requests WHERE request_channel IS DISTINCT FROM 'direct_profile'
    AND status IN ('active','pending','open') AND (expires_at IS NULL OR expires_at > now())
  LOOP PERFORM public.dispatch_trip_request(v_id); END LOOP;
END $$;

DO $$ DECLARE v_job_id bigint; BEGIN
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'process-trip-request-dispatches'
  LOOP PERFORM cron.unschedule(v_job_id); END LOOP;
END $$;
SELECT cron.schedule('process-trip-request-dispatches', '*/5 * * * *', 'SELECT public.process_trip_request_dispatches();');

NOTIFY pgrst, 'reload schema';