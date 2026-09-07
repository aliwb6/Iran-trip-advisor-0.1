-- Canonicalize currently-live profile fields used by the UI and define
-- profile completion independently from admin verification/approval.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS age smallint,
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_age_valid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_age_valid
  CHECK (age IS NULL OR age BETWEEN 1 AND 120);

COMMENT ON COLUMN public.profiles.nationality IS
  'Traveler-provided nationality or cultural origin.';
COMMENT ON COLUMN public.profiles.age IS
  'Traveler-provided age as entered in the current profile UI.';
COMMENT ON COLUMN public.profiles.profile_completed IS
  'For guide/agency profiles, whether required submission fields are complete. This is independent of admin approval and license verification.';

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
    tour_types, specialties, specialty, license_url
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_completed();

-- Backfill canonical completion state for existing guide/agency rows.
UPDATE public.profiles
SET profile_completed = (
  NULLIF(btrim(full_name), '') IS NOT NULL
  AND NULLIF(btrim(email), '') IS NOT NULL
  AND NULLIF(btrim(phone), '') IS NOT NULL
  AND NULLIF(btrim(city), '') IS NOT NULL
  AND NULLIF(btrim(languages), '') IS NOT NULL
  AND NULLIF(btrim(bio), '') IS NOT NULL
  AND NULLIF(btrim(avatar_url), '') IS NOT NULL
  AND (
    COALESCE(cardinality(tour_types), 0) > 0
    OR COALESCE(cardinality(specialties), 0) > 0
    OR NULLIF(btrim(specialty), '') IS NOT NULL
  )
  AND NULLIF(btrim(license_url), '') IS NOT NULL
)
WHERE role IN ('guide', 'agency');

NOTIFY pgrst, 'reload schema';
