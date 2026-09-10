\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE SCHEMA cron;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
GRANT USAGE ON SCHEMA public, auth, private TO authenticated;

CREATE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  role text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  is_approved boolean NOT NULL DEFAULT false,
  is_rejected boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  accept_bookings boolean NOT NULL DEFAULT false,
  city text,
  primary_city text,
  other_cities text[],
  email text,
  full_name text,
  notify_email boolean NOT NULL DEFAULT false
);

CREATE FUNCTION private.current_user_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND (p.role = 'admin' OR p.is_admin IS TRUE)
  )
$$;
REVOKE ALL ON FUNCTION private.current_user_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_is_admin() TO authenticated, service_role;

CREATE TABLE public.trip_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'active',
  destination text[],
  expires_at timestamptz,
  request_channel text NOT NULL DEFAULT 'marketplace',
  direct_provider_id uuid REFERENCES public.profiles(id),
  direct_response_deadline timestamptz,
  direct_escalated_at timestamptz,
  escalation_notified_provider_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  proposal_round integer NOT NULL DEFAULT 1,
  max_proposals integer NOT NULL DEFAULT 5,
  proposals_count integer NOT NULL DEFAULT 0,
  selected_guide_id uuid REFERENCES public.profiles(id),
  rebroadcast_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.trip_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_request_id uuid NOT NULL REFERENCES public.trip_requests(id),
  guide_id uuid NOT NULL REFERENCES public.profiles(id),
  proposal_round integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'accepted',
  accepted_at timestamptz,
  UNIQUE (trip_request_id, guide_id, proposal_round)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  type text NOT NULL,
  message text NOT NULL,
  related_request_id uuid REFERENCES public.trip_requests(id),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES public.profiles(id),
  recipient_email text NOT NULL,
  template text NOT NULL,
  payload jsonb NOT NULL,
  unique_key text NOT NULL UNIQUE
);

CREATE TABLE public.direct_trip_request_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL
);

CREATE TABLE cron.job (
  jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jobname text NOT NULL UNIQUE,
  schedule text NOT NULL,
  command text NOT NULL
);
CREATE FUNCTION cron.schedule(text, text, text)
RETURNS bigint LANGUAGE sql SET search_path = '' AS $$
  INSERT INTO cron.job(jobname, schedule, command) VALUES ($1, $2, $3)
  RETURNING jobid
$$;
CREATE FUNCTION cron.unschedule(bigint)
RETURNS boolean LANGUAGE sql SET search_path = '' AS $$
  DELETE FROM cron.job WHERE jobid = $1 RETURNING true
$$;

-- Reproduce the relevant pre-migration policies, including the trip_slots ->
-- trip_requests dependency that would recurse if the reverse dependency remained.
ALTER TABLE public.trip_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY trip_requests_authenticated_select ON public.trip_requests
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR status = 'active');
CREATE POLICY trip_slots_authenticated_select ON public.trip_slots
FOR SELECT TO authenticated USING (
  guide_id = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.trip_requests r
    WHERE r.id = trip_slots.trip_request_id AND r.user_id = (SELECT auth.uid())
  )
);
CREATE POLICY trip_slots_authenticated_insert ON public.trip_slots
FOR INSERT TO authenticated WITH CHECK (guide_id = (SELECT auth.uid()));
CREATE POLICY notifications_select_own ON public.notifications
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, UPDATE ON public.trip_requests TO authenticated;
GRANT SELECT, INSERT ON public.trip_slots TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;

-- Reproduce the production trigger name and old broad behavior. The corrective
-- migration must remove this trigger before creating its two disjoint triggers.
CREATE FUNCTION public.notify_guides_new_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, message, related_request_id)
  SELECT p.id, 'legacy_broadcast', 'legacy', NEW.id FROM public.profiles p
  WHERE p.role IN ('guide', 'agency');
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_notify_new_request AFTER INSERT ON public.trip_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_guides_new_request();

CREATE FUNCTION public.validate_trip_slot_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN RETURN NEW; END
$$;
CREATE TRIGGER trg_validate_trip_slot_insert BEFORE INSERT ON public.trip_slots
FOR EACH ROW EXECUTE FUNCTION public.validate_trip_slot_insert();

CREATE FUNCTION public.handle_trip_slot_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.trip_requests WHERE id = NEW.trip_request_id;
  INSERT INTO public.notifications(user_id, type, message, related_request_id)
  VALUES (v_owner, 'proposal_received', 'proposal received', NEW.trip_request_id);
  UPDATE public.trip_requests SET proposals_count = proposals_count + 1 WHERE id = NEW.trip_request_id;
  RETURN NEW;
END
$$;
CREATE TRIGGER on_trip_slot_insert AFTER INSERT ON public.trip_slots
FOR EACH ROW EXECUTE FUNCTION public.handle_trip_slot_insert();

CREATE PUBLICATION supabase_realtime FOR TABLE public.notifications;

INSERT INTO public.profiles(id, role, is_admin, is_approved, is_rejected, is_published,
  accept_bookings, city, primary_city, other_cities, email, full_name, notify_email)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'traveler', false, false, false, false, false, NULL, NULL, NULL, 'traveler@example.com', 'Traveler', false),
  ('00000000-0000-0000-0000-000000000009', 'admin', true, false, false, false, false, NULL, NULL, NULL, 'admin@example.com', 'Admin', false),
  ('00000000-0000-0000-0000-000000000101', 'guide', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p101@example.com', 'P101', true),
  ('00000000-0000-0000-0000-000000000102', 'agency', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p102@example.com', 'P102', true),
  ('00000000-0000-0000-0000-000000000103', 'guide', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p103@example.com', 'P103', true),
  ('00000000-0000-0000-0000-000000000104', 'agency', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p104@example.com', 'P104', true),
  ('00000000-0000-0000-0000-000000000105', 'guide', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p105@example.com', 'P105', true),
  ('00000000-0000-0000-0000-000000000106', 'agency', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p106@example.com', 'P106', true),
  ('00000000-0000-0000-0000-000000000107', 'guide', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p107@example.com', 'P107', true),
  ('00000000-0000-0000-0000-000000000108', 'agency', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p108@example.com', 'P108', true),
  ('00000000-0000-0000-0000-000000000109', 'guide', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p109@example.com', 'P109', true),
  ('00000000-0000-0000-0000-000000000110', 'agency', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p110@example.com', 'P110', true),
  ('00000000-0000-0000-0000-000000000111', 'guide', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p111@example.com', 'P111', true),
  ('00000000-0000-0000-0000-000000000112', 'agency', false, true, false, true, true, 'Tehran', 'Tehran', '{}', 'p112@example.com', 'P112', true),
  ('00000000-0000-0000-0000-000000000201', 'guide', false, true, false, true, true, 'Isfahan', 'Isfahan', '{}', 'p201@example.com', 'P201', false),
  ('00000000-0000-0000-0000-000000000202', 'agency', false, true, false, true, true, 'Isfahan', 'Isfahan', '{}', 'p202@example.com', 'P202', false),
  ('00000000-0000-0000-0000-000000000203', 'guide', false, true, false, true, true, 'Isfahan', 'Isfahan', '{}', 'p203@example.com', 'P203', false);

-- Active legacy marketplace request with two current-round proposals. The
-- migration must convert those providers to responded dispatches, then invite
-- only the three-provider remainder.
INSERT INTO public.trip_requests(id, user_id, status, destination, expires_at)
VALUES ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000000001',
        'active', ARRAY['Tehran'], now() + interval '7 days');
INSERT INTO public.trip_slots(trip_request_id, guide_id, proposal_round, accepted_at)
VALUES
  ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000000101', 1, now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000000102', 1, now() - interval '1 hour');
INSERT INTO public.trip_slots(trip_request_id, guide_id, proposal_round, status, accepted_at)
VALUES ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000000103',
        1, 'rejected', now() - interval '30 minutes');

-- Already-escalated direct request with two providers invited by the historical
-- array-based workflow. They must be materialized without duplicate notices.
INSERT INTO public.trip_requests(id, user_id, status, destination, expires_at, request_channel,
  direct_provider_id, direct_response_deadline, direct_escalated_at, escalation_notified_provider_ids)
VALUES ('00000000-0000-0000-0000-000000009002', '00000000-0000-0000-0000-000000000001',
  'active', ARRAY['Tehran'], now() + interval '7 days', 'direct_profile',
  '00000000-0000-0000-0000-000000000108', now() - interval '13 hours', now() - interval '1 hour',
  ARRAY['00000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000104'::uuid]);

\ir ../../supabase/migrations/20260910144144_marketplace_trip_request_dispatch.sql

CREATE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT COALESCE(p_condition, false) THEN RAISE EXCEPTION 'assertion failed: %', p_message; END IF;
END
$$;

SELECT pg_temp.assert_true(count(*) FILTER (WHERE status = 'responded') = 2
  AND count(*) FILTER (WHERE status = 'closed') = 1
  AND count(*) FILTER (WHERE status = 'pending') = 3,
  'legacy active proposals consume slots while rejected history is closed before filling three invitations')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000009001';
SELECT pg_temp.assert_true(count(*) = 3, 'legacy proposal backfill must notify only newly invited providers')
FROM public.notifications WHERE related_request_id = '00000000-0000-0000-0000-000000009001' AND type = 'tour_request';
SELECT pg_temp.assert_true(count(*) = 5, 'already-escalated direct request must retain/fill a five-provider cohort')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000009002';
SELECT pg_temp.assert_true(count(*) = 3, 'existing direct escalation recipients must not be notified twice')
FROM public.notifications WHERE related_request_id = '00000000-0000-0000-0000-000000009002' AND type = 'tour_request';

INSERT INTO public.trip_requests(id, user_id, status, destination, expires_at)
VALUES ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000001',
        'active', ARRAY['Tehran'], now() + interval '7 days');

SELECT pg_temp.assert_true(count(*) = 5, 'initial marketplace cohort must contain five providers')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001001';
SELECT pg_temp.assert_true(count(*) = 5, 'each initial invitation must create one notification')
FROM public.notifications WHERE related_request_id = '00000000-0000-0000-0000-000000001001' AND type = 'tour_request';
SELECT pg_temp.assert_true(count(*) = 0, 'legacy broadcast trigger must not execute')
FROM public.notifications WHERE related_request_id = '00000000-0000-0000-0000-000000001001' AND type = 'legacy_broadcast';

SELECT provider_id::text AS invited_id FROM public.trip_request_dispatches
WHERE trip_request_id = '00000000-0000-0000-0000-000000001001' ORDER BY provider_id LIMIT 1 \gset
SELECT p.id::text AS uninvited_id FROM public.profiles p
WHERE p.role IN ('guide', 'agency') AND NOT EXISTS (
  SELECT 1 FROM public.trip_request_dispatches d
  WHERE d.trip_request_id = '00000000-0000-0000-0000-000000001001' AND d.provider_id = p.id
) ORDER BY p.id LIMIT 1 \gset

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'invited_id', true);
SELECT pg_temp.assert_true(count(*) = 1, 'invited provider must read marketplace request')
FROM public.trip_requests WHERE id = '00000000-0000-0000-0000-000000001001';
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'uninvited_id', true);
SELECT pg_temp.assert_true(count(*) = 0, 'uninvited provider must not read marketplace request')
FROM public.trip_requests WHERE id = '00000000-0000-0000-0000-000000001001';
DO $$
DECLARE v_rejected boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.trip_slots(trip_request_id, guide_id)
    VALUES ('00000000-0000-0000-0000-000000001001', auth.uid());
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%was not dispatched to this provider%' THEN v_rejected := true;
    ELSE RAISE; END IF;
  END;
  PERFORM pg_temp.assert_true(v_rejected, 'uninvited provider proposal must be rejected');
END
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'invited_id', true);
INSERT INTO public.trip_slots(trip_request_id, guide_id)
VALUES ('00000000-0000-0000-0000-000000001001', :'invited_id');
RESET ROLE;
SELECT pg_temp.assert_true(count(*) = 1, 'proposal must mark invitation responded')
FROM public.trip_request_dispatches
WHERE trip_request_id = '00000000-0000-0000-0000-000000001001' AND provider_id = :'invited_id' AND status = 'responded';

SELECT provider_id::text AS second_invited_id FROM public.trip_request_dispatches
WHERE trip_request_id = '00000000-0000-0000-0000-000000001001' AND status = 'pending'
ORDER BY provider_id LIMIT 1 \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'second_invited_id', true);
INSERT INTO public.trip_slots(trip_request_id, guide_id)
VALUES ('00000000-0000-0000-0000-000000001001', :'second_invited_id');
RESET ROLE;

SELECT public.dispatch_trip_request('00000000-0000-0000-0000-000000001001');
SELECT pg_temp.assert_true(count(*) = 5, 'responded invitation must continue consuming cohort capacity')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001001';
SELECT pg_temp.assert_true(count(*) = 5, 'idempotent dispatch must not duplicate notifications')
FROM public.notifications WHERE related_request_id = '00000000-0000-0000-0000-000000001001' AND type = 'tour_request';

UPDATE public.trip_request_dispatches SET expires_at = now() - interval '1 second'
WHERE id = (SELECT id FROM public.trip_request_dispatches
  WHERE trip_request_id = '00000000-0000-0000-0000-000000001001' AND status = 'pending' LIMIT 1);
SELECT public.process_trip_request_dispatches();
SELECT pg_temp.assert_true(count(*) = 5, 'one expiry must yield one replacement')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001001'
  AND (status = 'responded' OR (status = 'pending' AND expires_at > now()));
SELECT pg_temp.assert_true(count(*) = 6, 'one expiry must add exactly one ledger row')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001001';

SELECT provider_id::text AS decline_id FROM public.trip_request_dispatches
WHERE trip_request_id = '00000000-0000-0000-0000-000000001001' AND status = 'pending' ORDER BY provider_id LIMIT 1 \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'decline_id', true);
SELECT public.decline_trip_request_invitation('00000000-0000-0000-0000-000000001001');
RESET ROLE;
SELECT pg_temp.assert_true(count(*) = 5, 'one decline must yield one replacement')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001001'
  AND (status = 'responded' OR (status = 'pending' AND expires_at > now()));
SELECT pg_temp.assert_true(count(*) = 7, 'one decline must add exactly one ledger row')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001001';

-- All five unanswered invitations can roll to a new batch of at most five,
-- while a destination with only three eligible providers remains underfilled.
INSERT INTO public.trip_requests(id, user_id, status, destination, expires_at)
VALUES
  ('00000000-0000-0000-0000-000000001004', '00000000-0000-0000-0000-000000000001', 'active', ARRAY['Tehran'], now() + interval '7 days'),
  ('00000000-0000-0000-0000-000000001005', '00000000-0000-0000-0000-000000000001', 'active', ARRAY['Isfahan'], now() + interval '7 days');
SELECT pg_temp.assert_true(count(*) = 3, 'fewer than five eligible providers must be handled')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001005';
UPDATE public.trip_request_dispatches SET expires_at = now() - interval '1 second'
WHERE trip_request_id = '00000000-0000-0000-0000-000000001004' AND status = 'pending';
SELECT public.process_trip_request_dispatches();
SELECT pg_temp.assert_true(count(*) = 10, 'five expirations may create one new batch of five')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001004';
SELECT pg_temp.assert_true(count(*) = 5, 'replacement batch must still occupy at most five slots')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001004'
  AND (status = 'responded' OR (status = 'pending' AND expires_at > now()));
SELECT pg_temp.assert_true(count(*) = count(DISTINCT provider_id), 'provider must not repeat in a request round')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001004';

SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated', 'public.dispatch_trip_request(uuid)', 'EXECUTE'),
  'authenticated must not execute dispatcher');
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated', 'public.process_trip_request_dispatches()', 'EXECUTE'),
  'authenticated must not execute cron worker');
SELECT pg_temp.assert_true(count(*) = 1, 'dispatch table must be in Realtime publication exactly once')
FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public' AND tablename = 'trip_request_dispatches';

-- Direct target is intentionally allowed even though Tehran is not compatible
-- with this request's Shiraz destination.
INSERT INTO public.trip_requests(id, user_id, status, destination, expires_at, request_channel,
  direct_provider_id, direct_response_deadline, max_proposals)
VALUES ('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000001',
  'active', ARRAY['Shiraz'], now() + interval '7 days', 'direct_profile',
  '00000000-0000-0000-0000-000000000108', now() + interval '12 hours', 1);
SELECT pg_temp.assert_true(count(*) = 1, 'direct target must receive exactly one notification')
FROM public.notifications WHERE related_request_id = '00000000-0000-0000-0000-000000001002' AND type = 'direct_trip_request';
SELECT pg_temp.assert_true(count(*) = 0, 'exclusive direct request must not dispatch marketplace providers')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001002';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000108', true);
SELECT pg_temp.assert_true(count(*) = 1, 'direct target must read exclusive request')
FROM public.trip_requests WHERE id = '00000000-0000-0000-0000-000000001002';
INSERT INTO public.trip_slots(trip_request_id, guide_id)
VALUES ('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000108');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000107', true);
SELECT pg_temp.assert_true(count(*) = 0, 'non-target must not read exclusive direct request')
FROM public.trip_requests WHERE id = '00000000-0000-0000-0000-000000001002';
RESET ROLE;

-- A stale direct request escalates once, notifies its traveler once, excludes
-- the original target, and uses the same controlled marketplace cohort.
INSERT INTO public.trip_requests(id, user_id, status, destination, expires_at, request_channel,
  direct_provider_id, direct_response_deadline, max_proposals)
VALUES ('00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-000000000001',
  'active', ARRAY['Tehran'], now() + interval '7 days', 'direct_profile',
  '00000000-0000-0000-0000-000000000108', now() - interval '1 minute', 1);
SELECT pg_temp.assert_true(public.escalate_stale_direct_trip_requests() = 1,
  'stale direct request must escalate once');
SELECT pg_temp.assert_true(public.escalate_stale_direct_trip_requests() = 0,
  'repeated direct escalation must be idempotent');
SELECT pg_temp.assert_true(count(*) = 1, 'traveler must receive exactly one escalation notification')
FROM public.notifications WHERE related_request_id = '00000000-0000-0000-0000-000000001003'
  AND type = 'direct_request_escalated';
SELECT pg_temp.assert_true(count(*) = 5, 'escalated direct request must dispatch no more than five providers')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001003';
SELECT pg_temp.assert_true(count(*) = 0, 'direct target must be excluded from escalation candidates')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001003'
  AND provider_id = '00000000-0000-0000-0000-000000000108';
SELECT pg_temp.assert_true(
  cardinality(escalation_notified_provider_ids) = 5,
  'legacy direct escalation recipient audit must track the dispatch ledger')
FROM public.trip_requests WHERE id = '00000000-0000-0000-0000-000000001003';

-- Proposal capacity is independent of the five-provider audience. Even when
-- multiple providers are invited, max_proposals still rejects the next insert.
INSERT INTO public.trip_requests(id, user_id, status, destination, expires_at, max_proposals)
VALUES ('00000000-0000-0000-0000-000000001006', '00000000-0000-0000-0000-000000000001',
        'active', ARRAY['Tehran'], now() + interval '7 days', 1);
SELECT provider_id::text AS cap_first_id FROM public.trip_request_dispatches
WHERE trip_request_id = '00000000-0000-0000-0000-000000001006' ORDER BY provider_id LIMIT 1 \gset
SELECT provider_id::text AS cap_second_id FROM public.trip_request_dispatches
WHERE trip_request_id = '00000000-0000-0000-0000-000000001006'
  AND provider_id <> :'cap_first_id'::uuid ORDER BY provider_id LIMIT 1 \gset
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'cap_first_id', true);
INSERT INTO public.trip_slots(trip_request_id, guide_id, proposal_round)
VALUES ('00000000-0000-0000-0000-000000001006', :'cap_first_id', 1);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'cap_second_id', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.trip_slots(trip_request_id, guide_id, proposal_round)
    VALUES ('00000000-0000-0000-0000-000000001006', auth.uid(), 1);
    RAISE EXCEPTION 'proposal limit insert unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'proposal limit insert unexpectedly succeeded' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%reached its proposal limit%' THEN RAISE; END IF;
  END;
END
$$;
RESET ROLE;

-- Rebroadcast preserves old proposal rows, advances the round, closes only the
-- old cohort, and starts a fresh five-provider cohort without notify-all.
UPDATE public.trip_requests SET status = 'expired', expires_at = now() - interval '1 second'
WHERE id = '00000000-0000-0000-0000-000000001001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT public.rebroadcast_trip_request('00000000-0000-0000-0000-000000001001');
RESET ROLE;
SELECT pg_temp.assert_true(proposal_round = 2 AND status = 'active' AND proposals_count = 0,
  'rebroadcast must advance and reset request round')
FROM public.trip_requests WHERE id = '00000000-0000-0000-0000-000000001001';
SELECT pg_temp.assert_true(count(*) = 5, 'rebroadcast must start a controlled fresh cohort')
FROM public.trip_request_dispatches WHERE trip_request_id = '00000000-0000-0000-0000-000000001001'
  AND proposal_round = 2;
SELECT pg_temp.assert_true(count(*) = 2, 'rebroadcast must preserve historical proposal rows')
FROM public.trip_slots WHERE trip_request_id = '00000000-0000-0000-0000-000000001001'
  AND proposal_round = 1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', true);
SELECT pg_temp.assert_true(count(*) = 1, 'admin must read through canonical private helper')
FROM public.trip_requests WHERE id = '00000000-0000-0000-0000-000000001001';
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT pg_temp.assert_true(count(*) > 0, 'traveler can query own proposal rows without RLS recursion')
FROM public.trip_slots;
RESET ROLE;

\if :{?keep_database}
COMMIT;
\else
ROLLBACK;
\endif
