-- First-class Tour Packages request workflow.
--
-- Both "Request Booking" and "Request this tour with another guide" now enter
-- the canonical trip_requests lifecycle, so provider notifications, proposals,
-- traveler selection, booking/payment, and paid-chat gating remain shared.
-- Public numeric provider codes are intentionally separate from auth UUIDs.

-- ---------------------------------------------------------------------------
-- 1. Stable, non-secret numeric codes for public guide/agency selection.
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.provider_code_seq
  AS bigint
  START WITH 100001
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS provider_code bigint;

ALTER SEQUENCE public.provider_code_seq
  OWNED BY public.profiles.provider_code;

UPDATE public.profiles
SET provider_code = nextval('public.provider_code_seq'::regclass)
WHERE role IN ('guide', 'agency')
  AND provider_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_provider_code_key
  ON public.profiles (provider_code)
  WHERE provider_code IS NOT NULL;

COMMENT ON COLUMN public.profiles.provider_code IS
  'Stable public numeric identifier for selecting a guide or agency. Auth UUIDs remain internal.';

CREATE OR REPLACE FUNCTION public.assign_provider_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Browser clients may not choose their own public code.
    NEW.provider_code := CASE
      WHEN NEW.role IN ('guide', 'agency')
        THEN nextval('public.provider_code_seq'::regclass)
      ELSE NULL
    END;
    RETURN NEW;
  END IF;

  -- Once assigned, the code is immutable, even if the profile role changes.
  IF OLD.provider_code IS NOT NULL THEN
    NEW.provider_code := OLD.provider_code;
  ELSIF NEW.role IN ('guide', 'agency') THEN
    NEW.provider_code := nextval('public.provider_code_seq'::regclass);
  ELSE
    NEW.provider_code := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_provider_code()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.provider_code_seq
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_assign_provider_code ON public.profiles;
CREATE TRIGGER trg_assign_provider_code
BEFORE INSERT OR UPDATE OF role, provider_code ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_provider_code();

-- provider_code is safe public profile data, but the underlying profiles table
-- remains private. Append it to the existing allowlisted view row type.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT
  id,
  username,
  role,
  full_name,
  city,
  primary_city,
  bio,
  avatar_url,
  gender,
  languages,
  specialties,
  specialty,
  price_per_day,
  other_cities,
  guide_since,
  established_year,
  tour_types,
  rating,
  review_count,
  is_verified,
  is_approved,
  is_published,
  is_public,
  gallery_images,
  accept_bookings,
  currency,
  timezone,
  license_status,
  created_at,
  updated_at,
  CASE
    WHEN role IN ('guide', 'agency')
      AND is_approved IS TRUE
      AND is_rejected IS NOT TRUE
      AND is_published IS TRUE
      AND is_public IS TRUE
      AND license_status = 'verified'
      AND NULLIF(btrim(license_url), '') IS NOT NULL
    THEN license_url
    ELSE NULL
  END AS public_license_path,
  special_abilities,
  has_vehicle,
  provider_code
FROM public.profiles
WHERE role IN ('guide', 'agency')
  AND is_public IS TRUE
  AND is_published IS TRUE
  AND is_approved IS TRUE
  AND is_rejected IS NOT TRUE;

ALTER VIEW public.public_profiles SET (security_invoker = true);
REVOKE ALL ON TABLE public.public_profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS SETOF public.public_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pp.id,
    pp.username,
    pp.role,
    pp.full_name,
    pp.city,
    pp.primary_city,
    pp.bio,
    pp.avatar_url,
    pp.gender,
    pp.languages,
    pp.specialties,
    pp.specialty,
    pp.price_per_day,
    pp.other_cities,
    pp.guide_since,
    pp.established_year,
    pp.tour_types,
    pp.rating,
    pp.review_count,
    pp.is_verified,
    pp.is_approved,
    pp.is_published,
    pp.is_public,
    pp.gallery_images,
    pp.accept_bookings,
    pp.currency,
    pp.timezone,
    pp.license_status,
    pp.created_at,
    pp.updated_at,
    pp.public_license_path,
    pp.special_abilities,
    pp.has_vehicle,
    pp.provider_code
  FROM public.public_profiles AS pp;
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Preserve the originating package through the canonical request lifecycle.
-- ---------------------------------------------------------------------------

ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS source_tour_id uuid
  REFERENCES public.tours(id) ON DELETE SET NULL;

ALTER TABLE public.direct_trip_request_intents
  ADD COLUMN IF NOT EXISTS source_tour_id uuid
  REFERENCES public.tours(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_trip_requests_source_tour_id
  ON public.trip_requests (source_tour_id)
  WHERE source_tour_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_direct_trip_request_intents_source_tour_id
  ON public.direct_trip_request_intents (source_tour_id)
  WHERE source_tour_id IS NOT NULL;

COMMENT ON COLUMN public.trip_requests.source_tour_id IS
  'Published Tour Package used as the editable starting point for this request.';

-- Starts a short-lived direct-request intent without exposing internal provider
-- UUIDs. A NULL provider code means the owner of the package (or the platform
-- admin for a platform-owned package); otherwise the exact eligible provider
-- matching the public numeric code is targeted.
CREATE OR REPLACE FUNCTION public.begin_package_trip_request(
  p_tour_id uuid,
  p_provider_code bigint DEFAULT NULL
)
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_tour
  FROM public.tours t
  WHERE t.id = p_tour_id
    AND t.status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tour package not found or unavailable';
  END IF;

  IF p_provider_code IS NOT NULL THEN
    SELECT * INTO v_provider
    FROM public.profiles p
    WHERE p.provider_code = p_provider_code
      AND p.role IN ('guide', 'agency')
      AND p.is_approved IS TRUE
      AND p.is_rejected IS NOT TRUE
      AND p.is_published IS TRUE
      AND p.is_public IS TRUE
      AND p.accept_bookings IS TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No available guide or agency matches that provider ID';
    END IF;
  ELSE
    SELECT * INTO v_provider
    FROM public.profiles p
    WHERE p.id = COALESCE(v_tour.owner_id, v_tour.guide_id, v_tour.agency_id)
      AND (
        (
          p.role IN ('guide', 'agency')
          AND p.is_approved IS TRUE
          AND p.is_rejected IS NOT TRUE
          AND p.is_published IS TRUE
          AND p.is_public IS TRUE
          AND p.accept_bookings IS TRUE
        )
        OR p.is_admin IS TRUE
        OR p.role = 'admin'
      );

    IF NOT FOUND AND v_tour.is_platform_tour IS TRUE THEN
      SELECT * INTO v_provider
      FROM public.profiles p
      WHERE p.is_admin IS TRUE OR p.role = 'admin'
      ORDER BY p.created_at ASC, p.id ASC
      LIMIT 1;
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The owner of this tour package is not accepting requests';
    END IF;
  END IF;

  IF v_provider.id = v_user_id THEN
    RAISE EXCEPTION 'You cannot send a package request to yourself';
  END IF;

  DELETE FROM public.direct_trip_request_intents
  WHERE user_id = v_user_id
    AND consumed_at IS NULL;

  INSERT INTO public.direct_trip_request_intents (
    user_id,
    provider_id,
    source_tour_id
  ) VALUES (
    v_user_id,
    v_provider.id,
    v_tour.id
  )
  RETURNING id INTO v_intent_id;

  RETURN jsonb_build_object(
    'intent_id', v_intent_id,
    'provider_name', v_provider.full_name,
    'provider_role', v_provider.role,
    'provider_code', v_provider.provider_code,
    'tour_id', v_tour.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_package_trip_request(uuid, bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_package_trip_request(uuid, bigint)
  TO authenticated;

-- Consume the package-aware intent atomically when TripRequestForm performs its
-- normal authenticated insert. Existing direct-profile requests keep working.
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
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_intent.provider_id
      AND (
        (
          p.role IN ('guide', 'agency')
          AND p.is_approved IS TRUE
          AND p.is_rejected IS NOT TRUE
          AND p.is_published IS TRUE
          AND p.is_public IS TRUE
          AND p.accept_bookings IS TRUE
        )
        OR (
          v_intent.source_tour_id IS NOT NULL
          AND (p.is_admin IS TRUE OR p.role = 'admin')
          AND EXISTS (
            SELECT 1
            FROM public.tours t
            WHERE t.id = v_intent.source_tour_id
              AND t.status = 'published'
              AND (t.is_platform_tour IS TRUE OR t.owner_id = p.id)
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'The selected provider is no longer available';
  END IF;

  NEW.request_channel := 'direct_profile';
  NEW.direct_provider_id := v_intent.provider_id;
  NEW.direct_response_deadline := now() + interval '12 hours';
  NEW.direct_escalated_at := NULL;
  NEW.escalation_notified_provider_ids := '{}'::uuid[];
  NEW.source_tour_id := v_intent.source_tour_id;
  NEW.max_proposals := 1;
  NEW.status := 'active';

  UPDATE public.direct_trip_request_intents
  SET consumed_at = now()
  WHERE id = v_intent.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_direct_trip_request_intent()
  FROM PUBLIC, anon, authenticated, service_role;

-- Keep source_tour_id immutable from the browser just like the other lifecycle
-- fields populated by the canonical direct-request trigger.
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
    NEW.escalation_notified_provider_ids IS DISTINCT FROM OLD.escalation_notified_provider_ids OR
    NEW.source_tour_id IS DISTINCT FROM OLD.source_tour_id
  ) THEN
    RAISE EXCEPTION 'Lifecycle fields must be changed through the canonical trip request RPCs';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_trip_request_lifecycle_fields()
  FROM PUBLIC, anon, authenticated, service_role;

-- The package owner can be an administrator for platform-owned tours. Allow
-- that exact direct target to submit a proposal, while preserving all existing
-- provider eligibility and marketplace-dispatch boundaries.
CREATE OR REPLACE FUNCTION private.trip_slot_actor_is_eligible(
  p_request_id uuid,
  p_provider_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_provider_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_provider_id
        AND (
          (
            p.role IN ('guide', 'agency')
            AND p.is_approved IS TRUE
            AND p.is_rejected IS NOT TRUE
          )
          OR (
            (p.is_admin IS TRUE OR p.role = 'admin')
            AND EXISTS (
              SELECT 1
              FROM public.trip_requests r
              JOIN public.tours t ON t.id = r.source_tour_id
              WHERE r.id = p_request_id
                AND r.request_channel = 'direct_profile'
                AND r.direct_escalated_at IS NULL
                AND r.direct_provider_id = p_provider_id
                AND t.status = 'published'
                AND (t.is_platform_tour IS TRUE OR t.owner_id = p_provider_id)
            )
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION private.trip_slot_actor_is_eligible(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.trip_slot_actor_is_eligible(uuid, uuid)
  TO authenticated;

DROP POLICY IF EXISTS trip_slots_authenticated_insert ON public.trip_slots;
CREATE POLICY trip_slots_authenticated_insert
ON public.trip_slots
FOR INSERT
TO authenticated
WITH CHECK (
  guide_id = (SELECT auth.uid())
  AND (SELECT private.trip_slot_actor_is_eligible(trip_request_id, guide_id))
);

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
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL OR NEW.guide_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Proposal provider must match the authenticated caller';
  END IF;

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

  IF v_request.request_channel = 'direct_profile'
     AND v_request.direct_escalated_at IS NULL THEN
    IF NEW.guide_id IS DISTINCT FROM v_request.direct_provider_id THEN
      RAISE EXCEPTION 'This direct trip request is currently private to another provider';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = NEW.guide_id
        AND (
          (
            p.role IN ('guide', 'agency')
            AND p.is_approved IS TRUE
            AND p.is_rejected IS NOT TRUE
            AND p.is_published IS TRUE
            AND p.is_public IS TRUE
            AND p.accept_bookings IS TRUE
          )
          OR (
            v_request.source_tour_id IS NOT NULL
            AND (p.is_admin IS TRUE OR p.role = 'admin')
            AND EXISTS (
              SELECT 1
              FROM public.tours t
              WHERE t.id = v_request.source_tour_id
                AND t.status = 'published'
                AND (t.is_platform_tour IS TRUE OR t.owner_id = p.id)
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'Provider is not eligible to submit this direct proposal';
    END IF;

    IF v_request.direct_response_deadline IS NOT NULL
       AND v_request.direct_response_deadline <= now() THEN
      RAISE EXCEPTION 'The exclusive response window has ended';
    END IF;
  ELSE
    IF NOT private.marketplace_provider_is_eligible(NEW.guide_id, v_request.destination) THEN
      RAISE EXCEPTION 'Guide or agency is not eligible to submit proposals';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.trip_request_dispatches d
      WHERE d.trip_request_id = v_request.id
        AND d.provider_id = NEW.guide_id
        AND d.proposal_round = v_request.proposal_round
        AND d.status = 'pending'
        AND d.expires_at > now()
    ) THEN
      RAISE EXCEPTION 'This trip request was not dispatched to this provider';
    END IF;
  END IF;

  NEW.proposal_round := v_request.proposal_round;

  SELECT count(*) INTO v_active_count
  FROM public.trip_slots s
  WHERE s.trip_request_id = v_request.id
    AND s.proposal_round = v_request.proposal_round
    AND s.status <> 'rejected';

  v_max := COALESCE(v_request.max_proposals, 5);
  IF v_active_count >= v_max THEN
    RAISE EXCEPTION 'This trip request has reached its proposal limit';
  END IF;

  UPDATE public.trip_request_dispatches
  SET status = 'responded', responded_at = now(), updated_at = now()
  WHERE trip_request_id = v_request.id
    AND provider_id = NEW.guide_id
    AND proposal_round = v_request.proposal_round
    AND status = 'pending';

  NEW.status := 'accepted';
  NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_trip_slot_insert()
  FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
