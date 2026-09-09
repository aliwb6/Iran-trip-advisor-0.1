-- Provider-declared capabilities. Vehicle availability intentionally has no
-- default: NULL means unanswered, while false is an explicit answer.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS special_abilities text[],
  ADD COLUMN IF NOT EXISTS has_vehicle boolean;

COMMENT ON COLUMN public.profiles.special_abilities IS
  'Provider-declared special abilities. At least one non-empty value is required for new approval.';
COMMENT ON COLUMN public.profiles.has_vehicle IS
  'Whether a provider has a vehicle available for tours. NULL means unanswered.';

-- Append the two safe fields to the existing allowlisted public surface. Keep
-- public_license_path in its existing position so CREATE OR REPLACE VIEW can
-- add columns without changing the established composite row type ordering.
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
  has_vehicle
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
    pp.has_vehicle
  FROM public.public_profiles AS pp;
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_profile_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IN ('guide', 'agency') THEN
    NEW.profile_completed := (
      NULLIF(btrim(NEW.full_name), '') IS NOT NULL
      AND NULLIF(btrim(NEW.email), '') IS NOT NULL
      AND NULLIF(btrim(NEW.phone), '') IS NOT NULL
      AND NULLIF(btrim(NEW.city), '') IS NOT NULL
      AND NULLIF(btrim(NEW.languages), '') IS NOT NULL
      AND NULLIF(btrim(NEW.bio), '') IS NOT NULL
      AND NULLIF(btrim(NEW.avatar_url), '') IS NOT NULL
      AND (
        COALESCE(cardinality(NEW.tour_types), 0) > 0
        OR COALESCE(cardinality(NEW.specialties), 0) > 0
        OR NULLIF(btrim(NEW.specialty), '') IS NOT NULL
      )
      AND EXISTS (
        SELECT 1
        FROM unnest(NEW.special_abilities) AS ability
        WHERE NULLIF(btrim(ability), '') IS NOT NULL
      )
      AND NEW.has_vehicle IS NOT NULL
      AND NULLIF(btrim(NEW.license_url), '') IS NOT NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_completed ON public.profiles;
CREATE TRIGGER trg_profile_completed
  BEFORE INSERT OR UPDATE OF
    role, full_name, email, phone, city, languages, bio, avatar_url,
    tour_types, specialties, specialty, special_abilities, has_vehicle,
    license_url
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_completed();

CREATE OR REPLACE FUNCTION public.enforce_guide_profile_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  has_required_fields boolean;
  reviewer_is_admin boolean := false;
  approval_started boolean := false;
  rejection_started boolean := false;
  protected_state_changed boolean := false;
BEGIN
  IF NEW.role NOT IN ('guide', 'agency') OR TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  has_required_fields := (
    NULLIF(btrim(NEW.full_name), '') IS NOT NULL
    AND NULLIF(btrim(NEW.email), '') IS NOT NULL
    AND NULLIF(btrim(NEW.phone), '') IS NOT NULL
    AND NULLIF(btrim(NEW.city), '') IS NOT NULL
    AND NULLIF(btrim(NEW.languages), '') IS NOT NULL
    AND (
      COALESCE(cardinality(NEW.tour_types), 0) > 0
      OR COALESCE(cardinality(NEW.specialties), 0) > 0
      OR NULLIF(btrim(NEW.specialty), '') IS NOT NULL
    )
    AND EXISTS (
      SELECT 1
      FROM unnest(NEW.special_abilities) AS ability
      WHERE NULLIF(btrim(ability), '') IS NOT NULL
    )
    AND NEW.has_vehicle IS NOT NULL
    AND NULLIF(btrim(NEW.bio), '') IS NOT NULL
    AND NULLIF(btrim(NEW.license_url), '') IS NOT NULL
  );

  approval_started := NEW.is_approved IS TRUE AND COALESCE(OLD.is_approved, false) IS FALSE;
  rejection_started := NEW.is_rejected IS TRUE AND COALESCE(OLD.is_rejected, false) IS FALSE;
  protected_state_changed := (
    NEW.is_approved IS DISTINCT FROM OLD.is_approved
    OR NEW.is_rejected IS DISTINCT FROM OLD.is_rejected
    OR NEW.is_published IS DISTINCT FROM OLD.is_published
    OR NEW.approval_rejection_reason IS DISTINCT FROM OLD.approval_rejection_reason
    OR NEW.approval_reviewed_at IS DISTINCT FROM OLD.approval_reviewed_at
    OR (
      NEW.license_status IS DISTINCT FROM OLD.license_status
      AND NEW.license_status IN ('verified', 'rejected')
    )
  );

  IF protected_state_changed THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles AS reviewer
      WHERE reviewer.id = (SELECT auth.uid())
        AND (reviewer.role = 'admin' OR reviewer.is_admin IS TRUE)
    ) INTO reviewer_is_admin;

    IF NOT reviewer_is_admin THEN
      RAISE EXCEPTION 'Only an administrator may moderate a guide profile'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF approval_started AND rejection_started THEN
    RAISE EXCEPTION 'A guide profile cannot be approved and rejected together'
      USING ERRCODE = 'check_violation';
  END IF;

  IF approval_started THEN
    IF NOT has_required_fields THEN
      RAISE EXCEPTION 'Guide profile is missing required approval fields'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.is_rejected := false;
    NEW.license_status := 'verified';
    NEW.is_published := true;
    NEW.approval_rejection_reason := NULL;
    NEW.approval_reviewed_at := COALESCE(NEW.approval_reviewed_at, now());
  ELSIF NEW.is_rejected IS TRUE THEN
    IF NULLIF(btrim(NEW.approval_rejection_reason), '') IS NULL THEN
      RAISE EXCEPTION 'A rejection reason is required'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.approval_rejection_reason := btrim(NEW.approval_rejection_reason);
    NEW.is_approved := false;
    NEW.license_status := 'rejected';
    NEW.is_published := false;
    NEW.approval_reviewed_at := COALESCE(NEW.approval_reviewed_at, now());
  END IF;

  RETURN NEW;
END;
$$;

-- Existing moderation trigger remains in place and now calls the replacement
-- function. No approval, publication, license, or profile data is backfilled.
NOTIFY pgrst, 'reload schema';
