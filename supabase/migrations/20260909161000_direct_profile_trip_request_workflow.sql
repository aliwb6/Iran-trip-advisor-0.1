-- Direct profile trip-request workflow.
-- A traveler can target a specific approved provider for 12 hours. If that
-- provider does not submit a proposal in time, the request is opened to the
-- marketplace and five other eligible guides are explicitly invited.

ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS request_channel text NOT NULL DEFAULT 'marketplace',
  ADD COLUMN IF NOT EXISTS direct_provider_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS direct_response_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS direct_escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_notified_provider_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.trip_requests
  DROP CONSTRAINT IF EXISTS trip_requests_request_channel_check;
ALTER TABLE public.trip_requests
  ADD CONSTRAINT trip_requests_request_channel_check
  CHECK (request_channel IN ('marketplace', 'direct_profile'));

CREATE INDEX IF NOT EXISTS idx_trip_requests_direct_deadline
  ON public.trip_requests(direct_response_deadline)
  WHERE request_channel = 'direct_profile' AND direct_escalated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trip_requests_direct_provider
  ON public.trip_requests(direct_provider_id)
  WHERE direct_provider_id IS NOT NULL;

COMMENT ON COLUMN public.trip_requests.request_channel IS
  'marketplace for normal requests; direct_profile when started from a guide/agency profile.';
COMMENT ON COLUMN public.trip_requests.direct_provider_id IS
  'Provider that receives the exclusive first-response window for a direct profile request.';
COMMENT ON COLUMN public.trip_requests.direct_response_deadline IS
  'End of the exclusive response window for a direct profile request.';
COMMENT ON COLUMN public.trip_requests.direct_escalated_at IS
  'When an unanswered direct request was opened to the marketplace.';
COMMENT ON COLUMN public.trip_requests.escalation_notified_provider_ids IS
  'Guides explicitly invited when an unanswered direct request was opened to the marketplace.';

-- A short-lived server-side intent lets the existing TripRequestForm remain the
-- single canonical UI and payload builder. The next request insert by this user
-- consumes the intent atomically in a BEFORE INSERT trigger.
CREATE TABLE IF NOT EXISTS public.direct_trip_request_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 minutes'),
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_direct_trip_request_intents_user
  ON public.direct_trip_request_intents(user_id, created_at DESC)
  WHERE consumed_at IS NULL;

ALTER TABLE public.direct_trip_request_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.direct_trip_request_intents FROM anon, authenticated;

-- Durable email queue. Sending is intentionally decoupled from the request
-- transaction so a mail-provider outage can never make trip creation fail.
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  template text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  unique_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_pending
  ON public.email_outbox(status, available_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_outbox FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.begin_direct_trip_request(provider_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_intent_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF provider_id IS NULL OR provider_id = v_user_id THEN
    RAISE EXCEPTION 'Invalid direct trip request provider';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = provider_id
      AND p.role IN ('guide', 'agency')
      AND p.is_approved IS TRUE
      AND p.is_rejected IS NOT TRUE
      AND p.is_published IS TRUE
      AND p.accept_bookings IS TRUE
  ) THEN
    RAISE EXCEPTION 'This guide or agency is not available for direct trip requests';
  END IF;

  DELETE FROM public.direct_trip_request_intents
  WHERE user_id = v_user_id
    AND consumed_at IS NULL;

  INSERT INTO public.direct_trip_request_intents (user_id, provider_id)
  VALUES (v_user_id, provider_id)
  RETURNING id INTO v_intent_id;

  RETURN v_intent_id;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_direct_trip_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_direct_trip_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_direct_trip_request_intent(intent_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.direct_trip_request_intents
  WHERE id = intent_id
    AND user_id = (SELECT auth.uid())
    AND consumed_at IS NULL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_direct_trip_request_intent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_direct_trip_request_intent(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_direct_trip_request_intent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.direct_trip_request_intents%ROWTYPE;
BEGIN
  IF NEW.user_id IS NULL OR NEW.user_id <> (SELECT auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_intent
  FROM public.direct_trip_request_intents i
  WHERE i.user_id = NEW.user_id
    AND i.consumed_at IS NULL
    AND i.expires_at > now()
  ORDER BY i.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Re-check eligibility at the exact moment the trip request is submitted.
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_intent.provider_id
      AND p.role IN ('guide', 'agency')
      AND p.is_approved IS TRUE
      AND p.is_rejected IS NOT TRUE
      AND p.is_published IS TRUE
      AND p.accept_bookings IS TRUE
  ) THEN
    RAISE EXCEPTION 'The selected guide or agency is no longer available';
  END IF;

  NEW.request_channel := 'direct_profile';
  NEW.direct_provider_id := v_intent.provider_id;
  NEW.direct_response_deadline := now() + interval '12 hours';
  NEW.direct_escalated_at := NULL;
  NEW.escalation_notified_provider_ids := '{}'::uuid[];
  NEW.max_proposals := 1;
  NEW.status := 'active';

  UPDATE public.direct_trip_request_intents
  SET consumed_at = now()
  WHERE id = v_intent.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_direct_trip_request_intent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_apply_direct_trip_request_intent ON public.trip_requests;
CREATE TRIGGER trg_apply_direct_trip_request_intent
  BEFORE INSERT ON public.trip_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_direct_trip_request_intent();

-- Replace the legacy new-request broadcast. Direct requests notify only their
-- target provider; marketplace requests retain the existing city-based broadcast.
CREATE OR REPLACE FUNCTION public.notify_guides_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_provider public.profiles%ROWTYPE;
  v_destination text;
BEGIN
  v_destination := COALESCE(array_to_string(NEW.destination, ', '), 'Iran');

  IF NEW.request_channel = 'direct_profile' AND NEW.direct_provider_id IS NOT NULL THEN
    SELECT * INTO v_provider
    FROM public.profiles
    WHERE id = NEW.direct_provider_id;

    IF FOUND THEN
      INSERT INTO public.notifications (user_id, type, message, related_request_id)
      VALUES (
        v_provider.id,
        'direct_trip_request',
        'You have a direct trip request for ' || v_destination || '. Submit your proposal within 12 hours to keep the request exclusive.',
        NEW.id
      );

      IF v_provider.notify_email IS TRUE AND NULLIF(btrim(v_provider.email), '') IS NOT NULL THEN
        INSERT INTO public.email_outbox (
          recipient_user_id, recipient_email, template, payload, unique_key
        ) VALUES (
          v_provider.id,
          v_provider.email,
          'direct_trip_request',
          jsonb_build_object(
            'request_id', NEW.id,
            'destination', NEW.destination,
            'deadline', NEW.direct_response_deadline,
            'provider_name', v_provider.full_name
          ),
          'direct-trip-request:' || NEW.id::text || ':' || v_provider.id::text
        )
        ON CONFLICT (unique_key) DO NOTHING;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  SELECT p.id,
         'tour_request',
         'A new tour request matches your city',
         NEW.id
  FROM public.profiles p
  WHERE p.role IN ('guide', 'agency')
    AND p.is_approved IS TRUE
    AND p.is_rejected IS NOT TRUE
    AND p.city = ANY(NEW.destination);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_guides_new_request() FROM PUBLIC, anon, authenticated;

-- Direct requests are private to their target provider during the exclusive
-- response window. Once escalated they become visible through the normal
-- marketplace request feed. Selected providers retain read access afterwards.
DROP POLICY IF EXISTS trip_requests_authenticated_select ON public.trip_requests;
CREATE POLICY trip_requests_authenticated_select
ON public.trip_requests
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR selected_guide_id = (SELECT auth.uid())
  OR (
    status IN ('active', 'pending', 'open', 'proposals_ready')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('guide', 'agency')
    )
    AND (
      request_channel <> 'direct_profile'
      OR direct_escalated_at IS NOT NULL
      OR direct_provider_id = (SELECT auth.uid())
    )
  )
);

-- Enforce the exclusive response window at the proposal boundary too. This is
-- race-safe because both proposal insertion and escalation lock the request row.
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

  IF v_request.request_channel = 'direct_profile'
     AND v_request.direct_escalated_at IS NULL THEN
    IF NEW.guide_id <> v_request.direct_provider_id THEN
      RAISE EXCEPTION 'This direct trip request is currently private to another provider';
    END IF;

    IF v_request.direct_response_deadline IS NOT NULL
       AND v_request.direct_response_deadline <= now() THEN
      RAISE EXCEPTION 'The exclusive response window has ended';
    END IF;
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

-- Add the new direct-workflow fields to the canonical lifecycle guard.
CREATE OR REPLACE FUNCTION public.protect_trip_request_lifecycle_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND (
    NEW.user_id IS DISTINCT FROM OLD.user_id OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.selected_guide_id IS DISTINCT FROM OLD.selected_guide_id OR
    NEW.proposals_count IS DISTINCT FROM OLD.proposals_count OR
    NEW.proposal_round IS DISTINCT FROM OLD.proposal_round OR
    NEW.rebroadcast_count IS DISTINCT FROM OLD.rebroadcast_count OR
    NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
    NEW.request_channel IS DISTINCT FROM OLD.request_channel OR
    NEW.direct_provider_id IS DISTINCT FROM OLD.direct_provider_id OR
    NEW.direct_response_deadline IS DISTINCT FROM OLD.direct_response_deadline OR
    NEW.direct_escalated_at IS DISTINCT FROM OLD.direct_escalated_at OR
    NEW.escalation_notified_provider_ids IS DISTINCT FROM OLD.escalation_notified_provider_ids
  ) THEN
    RAISE EXCEPTION 'Lifecycle fields must be changed through the canonical trip request RPCs';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_trip_request_lifecycle_fields() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.escalate_stale_direct_trip_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_invited_ids uuid[];
  v_destination text;
  v_escalated integer := 0;
BEGIN
  FOR v_request IN
    SELECT r.*
    FROM public.trip_requests r
    WHERE r.request_channel = 'direct_profile'
      AND r.direct_provider_id IS NOT NULL
      AND r.direct_escalated_at IS NULL
      AND r.direct_response_deadline IS NOT NULL
      AND r.direct_response_deadline <= now()
      AND r.status IN ('active', 'pending', 'open')
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND NOT EXISTS (
        SELECT 1
        FROM public.trip_slots s
        WHERE s.trip_request_id = r.id
          AND s.proposal_round = r.proposal_round
          AND s.status <> 'rejected'
      )
    ORDER BY r.direct_response_deadline
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT COALESCE(array_agg(candidate.id), '{}'::uuid[])
    INTO v_invited_ids
    FROM (
      SELECT p.id
      FROM public.profiles p
      WHERE p.role = 'guide'
        AND p.id <> v_request.direct_provider_id
        AND p.id <> v_request.user_id
        AND p.is_approved IS TRUE
        AND p.is_rejected IS NOT TRUE
        AND p.is_published IS TRUE
        AND p.accept_bookings IS TRUE
      ORDER BY
        CASE
          WHEN v_request.destination IS NOT NULL AND (
            p.city = ANY(v_request.destination)
            OR p.primary_city = ANY(v_request.destination)
            OR COALESCE(p.other_cities, '{}'::text[]) && v_request.destination
          ) THEN 1 ELSE 0
        END DESC,
        random()
      LIMIT 5
    ) candidate;

    UPDATE public.trip_requests
    SET direct_escalated_at = now(),
        escalation_notified_provider_ids = v_invited_ids,
        max_proposals = 5,
        status = 'active',
        updated_at = now()
    WHERE id = v_request.id;

    v_destination := COALESCE(array_to_string(v_request.destination, ', '), 'Iran');

    INSERT INTO public.notifications (user_id, type, message, related_request_id)
    VALUES (
      v_request.user_id,
      'direct_request_escalated',
      'Your selected guide did not respond within 12 hours. Your trip request is now open to other guides.',
      v_request.id
    );

    INSERT INTO public.notifications (user_id, type, message, related_request_id)
    SELECT p.id,
           'tour_request_invite',
           'A trip request for ' || v_destination || ' is now open for proposals.',
           v_request.id
    FROM public.profiles p
    WHERE p.id = ANY(v_invited_ids);

    INSERT INTO public.email_outbox (
      recipient_user_id, recipient_email, template, payload, unique_key
    )
    SELECT p.id,
           p.email,
           'trip_request_escalation_invite',
           jsonb_build_object(
             'request_id', v_request.id,
             'destination', v_request.destination,
             'guide_name', p.full_name
           ),
           'trip-request-escalation:' || v_request.id::text || ':' || p.id::text
    FROM public.profiles p
    WHERE p.id = ANY(v_invited_ids)
      AND p.notify_email IS TRUE
      AND NULLIF(btrim(p.email), '') IS NOT NULL
    ON CONFLICT (unique_key) DO NOTHING;

    v_escalated := v_escalated + 1;
  END LOOP;

  -- Opportunistic cleanup of stale/consumed intents.
  DELETE FROM public.direct_trip_request_intents
  WHERE consumed_at IS NOT NULL
     OR expires_at <= now();

  RETURN v_escalated;
END;
$$;

REVOKE ALL ON FUNCTION public.escalate_stale_direct_trip_requests() FROM PUBLIC, anon, authenticated;

-- Run frequently enough that the 12-hour deadline is respected without
-- introducing application-server timers or dependence on an open browser tab.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  FOR v_job_id IN
    SELECT jobid FROM cron.job WHERE jobname = 'escalate-stale-direct-trip-requests'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'escalate-stale-direct-trip-requests',
  '*/5 * * * *',
  'SELECT public.escalate_stale_direct_trip_requests();'
);

NOTIFY pgrst, 'reload schema';
