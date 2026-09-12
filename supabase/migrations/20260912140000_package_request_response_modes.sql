-- Keep the two tour-package request experiences distinct while continuing to
-- use the canonical trip_requests -> trip_slots -> booking lifecycle.

ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS request_kind text NOT NULL DEFAULT 'general';

ALTER TABLE public.direct_trip_request_intents
  ADD COLUMN IF NOT EXISTS request_kind text NOT NULL DEFAULT 'general';

ALTER TABLE public.trip_requests
  DROP CONSTRAINT IF EXISTS trip_requests_request_kind_check;
ALTER TABLE public.trip_requests
  ADD CONSTRAINT trip_requests_request_kind_check
  CHECK (request_kind IN ('general', 'package_booking', 'package_private'));

ALTER TABLE public.direct_trip_request_intents
  DROP CONSTRAINT IF EXISTS direct_trip_request_intents_request_kind_check;
ALTER TABLE public.direct_trip_request_intents
  ADD CONSTRAINT direct_trip_request_intents_request_kind_check
  CHECK (request_kind IN ('general', 'package_booking', 'package_private'));

COMMENT ON COLUMN public.trip_requests.request_kind IS
  'general is a normal trip request; package_booking targets the package owner; package_private targets another provider using a package only as reference.';

-- Package requests remain private. They deliberately have no direct-response
-- deadline, so the marketplace escalation worker cannot redistribute them.
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

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_intent.provider_id
      AND ((p.role IN ('guide', 'agency') AND p.is_approved IS TRUE
            AND p.is_rejected IS NOT TRUE AND p.is_published IS TRUE
            AND p.is_public IS TRUE AND p.accept_bookings IS TRUE)
        OR (v_intent.source_tour_id IS NOT NULL AND (p.is_admin IS TRUE OR p.role = 'admin')
            AND EXISTS (SELECT 1 FROM public.tours t WHERE t.id = v_intent.source_tour_id
              AND t.status = 'published' AND (t.is_platform_tour IS TRUE OR t.owner_id = p.id))))
  ) THEN
    RAISE EXCEPTION 'The selected provider is no longer available';
  END IF;

  NEW.request_channel := 'direct_profile';
  NEW.direct_provider_id := v_intent.provider_id;
  NEW.direct_response_deadline := CASE
    WHEN v_intent.request_kind IN ('package_booking', 'package_private') THEN NULL
    ELSE now() + interval '12 hours'
  END;
  NEW.direct_escalated_at := NULL;
  NEW.escalation_notified_provider_ids := '{}'::uuid[];
  NEW.source_tour_id := v_intent.source_tour_id;
  NEW.request_kind := v_intent.request_kind;
  NEW.max_proposals := 1;
  NEW.status := 'active';

  UPDATE public.direct_trip_request_intents SET consumed_at = now() WHERE id = v_intent.id;
  RETURN NEW;
END;
$$;

-- request_kind is server-assigned alongside the other lifecycle fields.
CREATE OR REPLACE FUNCTION public.protect_trip_request_lifecycle_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND (
    NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.status IS DISTINCT FROM OLD.status OR
    NEW.selected_guide_id IS DISTINCT FROM OLD.selected_guide_id OR
    NEW.proposals_count IS DISTINCT FROM OLD.proposals_count OR
    NEW.proposal_round IS DISTINCT FROM OLD.proposal_round OR
    NEW.rebroadcast_count IS DISTINCT FROM OLD.rebroadcast_count OR
    NEW.expires_at IS DISTINCT FROM OLD.expires_at OR
    NEW.request_channel IS DISTINCT FROM OLD.request_channel OR
    NEW.direct_provider_id IS DISTINCT FROM OLD.direct_provider_id OR
    NEW.direct_response_deadline IS DISTINCT FROM OLD.direct_response_deadline OR
    NEW.direct_escalated_at IS DISTINCT FROM OLD.direct_escalated_at OR
    NEW.escalation_notified_provider_ids IS DISTINCT FROM OLD.escalation_notified_provider_ids OR
    NEW.source_tour_id IS DISTINCT FROM OLD.source_tour_id OR
    NEW.request_kind IS DISTINCT FROM OLD.request_kind
  ) THEN
    RAISE EXCEPTION 'Lifecycle fields must be changed through the canonical trip request RPCs';
  END IF;
  RETURN NEW;
END;
$$;

-- Replace only the package-start RPC so the server records whether this is the
-- owner booking path or an invitation to a different provider.
CREATE OR REPLACE FUNCTION public.begin_package_trip_request(p_tour_id uuid, p_provider_code bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_tour public.tours%ROWTYPE;
  v_provider public.profiles%ROWTYPE;
  v_intent_id uuid;
  v_kind text := CASE WHEN p_provider_code IS NULL THEN 'package_booking' ELSE 'package_private' END;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_tour FROM public.tours t WHERE t.id = p_tour_id AND t.status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Tour package not found or unavailable'; END IF;

  IF p_provider_code IS NOT NULL THEN
    SELECT * INTO v_provider FROM public.profiles p
    WHERE p.provider_code = p_provider_code AND p.role IN ('guide', 'agency')
      AND p.is_approved IS TRUE AND p.is_rejected IS NOT TRUE AND p.is_published IS TRUE
      AND p.is_public IS TRUE AND p.accept_bookings IS TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No available guide or agency matches that provider ID'; END IF;
  ELSE
    SELECT * INTO v_provider FROM public.profiles p
    WHERE p.id = COALESCE(v_tour.owner_id, v_tour.guide_id, v_tour.agency_id)
      AND ((p.role IN ('guide', 'agency') AND p.is_approved IS TRUE AND p.is_rejected IS NOT TRUE
            AND p.is_published IS TRUE AND p.is_public IS TRUE AND p.accept_bookings IS TRUE)
        OR p.is_admin IS TRUE OR p.role = 'admin');
    IF NOT FOUND AND v_tour.is_platform_tour IS TRUE THEN
      SELECT * INTO v_provider FROM public.profiles p
      WHERE p.is_admin IS TRUE OR p.role = 'admin' ORDER BY p.created_at ASC, p.id ASC LIMIT 1;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'The owner of this tour package is not accepting requests'; END IF;
  END IF;
  IF v_provider.id = v_user_id THEN RAISE EXCEPTION 'You cannot send a package request to yourself'; END IF;

  DELETE FROM public.direct_trip_request_intents WHERE user_id = v_user_id AND consumed_at IS NULL;
  INSERT INTO public.direct_trip_request_intents (user_id, provider_id, source_tour_id, request_kind)
  VALUES (v_user_id, v_provider.id, v_tour.id, v_kind) RETURNING id INTO v_intent_id;
  RETURN jsonb_build_object('intent_id', v_intent_id, 'provider_name', v_provider.full_name,
    'provider_role', v_provider.role, 'provider_code', v_provider.provider_code,
    'tour_id', v_tour.id, 'request_kind', v_kind);
END;
$$;

-- A package recipient may decline exactly once. The request is cancelled rather
-- than escalated, and the traveler gets one durable in-app notification.
CREATE OR REPLACE FUNCTION public.decline_package_trip_request(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_request public.trip_requests%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_request FROM public.trip_requests WHERE id = request_id FOR UPDATE;
  IF NOT FOUND OR v_request.request_kind NOT IN ('package_booking', 'package_private')
     OR v_request.request_channel <> 'direct_profile'
     OR v_request.direct_provider_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Only the selected package recipient can decline this request';
  END IF;
  IF v_request.status NOT IN ('active','pending','open') THEN
    RAISE EXCEPTION 'This package request can no longer be declined';
  END IF;
  UPDATE public.trip_requests SET status = 'cancelled', updated_at = now() WHERE id = request_id;
  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (v_request.user_id, 'package_request_declined',
    CASE WHEN v_request.request_kind = 'package_booking'
      THEN 'The tour package owner declined your booking request.'
      ELSE 'The selected guide or agency declined your private tour request.' END,
    request_id);
  RETURN true;
END;
$$;

-- One recipient notification per direct request, with package-specific wording.
CREATE OR REPLACE FUNCTION public.notify_guides_new_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_provider public.profiles%ROWTYPE;
  v_destination text;
  v_tour_title text;
  v_message text;
BEGIN
  IF NEW.request_channel IS DISTINCT FROM 'direct_profile' OR NEW.direct_provider_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_provider FROM public.profiles WHERE id = NEW.direct_provider_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(btrim(t.title), ''), 'this tour package') INTO v_tour_title
  FROM public.tours t WHERE t.id = NEW.source_tour_id;
  v_destination := COALESCE(array_to_string(NEW.destination, ', '), 'Iran');
  v_message := CASE NEW.request_kind
    WHEN 'package_booking' THEN 'New booking request for "' || COALESCE(v_tour_title, 'this tour package') || '".'
    WHEN 'package_private' THEN 'You received a private tour request based on "' || COALESCE(v_tour_title, 'this tour package') || '".'
    ELSE 'You have a direct trip request for ' || v_destination || '. Submit your proposal within 12 hours to keep the request exclusive.'
  END;
  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (v_provider.id, CASE WHEN NEW.request_kind = 'general' THEN 'direct_trip_request' ELSE NEW.request_kind END, v_message, NEW.id);
  IF v_provider.notify_email IS TRUE AND NULLIF(btrim(v_provider.email), '') IS NOT NULL THEN
    INSERT INTO public.email_outbox (recipient_user_id, recipient_email, template, payload, unique_key)
    VALUES (v_provider.id, v_provider.email, 'direct_trip_request',
      jsonb_build_object('request_id', NEW.id, 'destination', NEW.destination, 'deadline', NEW.direct_response_deadline,
        'provider_name', v_provider.full_name, 'request_kind', NEW.request_kind, 'tour_title', v_tour_title),
      'direct-trip-request:' || NEW.id::text || ':' || v_provider.id::text)
    ON CONFLICT (unique_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.decline_package_trip_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_package_trip_request(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
