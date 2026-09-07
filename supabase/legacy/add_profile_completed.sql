-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add_profile_completed
-- Adds profile_completed and review_requested columns to the profiles table,
-- plus a Postgres function + trigger that auto-maintains profile_completed
-- whenever a profile row is updated.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add new columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS review_requested BOOLEAN DEFAULT false;

-- 2. Index for faster public queries filtering on both columns
CREATE INDEX IF NOT EXISTS idx_profiles_public_visibility
  ON profiles (is_approved, profile_completed)
  WHERE is_approved = true AND profile_completed = true;

-- 3. Helper function that computes whether a profile row is "complete"
--    based on its role.  Returns true/false.
CREATE OR REPLACE FUNCTION check_profile_completed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'guide' OR NEW.role = 'agency' THEN
    NEW.profile_completed := (
      -- full_name
      (NEW.full_name IS NOT NULL AND NEW.full_name <> '')
      -- phone
      AND (NEW.phone IS NOT NULL AND NEW.phone <> '')
      -- city
      AND (NEW.city IS NOT NULL AND NEW.city <> '')
      -- bio (at least 50 characters)
      AND (NEW.bio IS NOT NULL AND length(NEW.bio) >= 50)
      -- avatar_url
      AND (NEW.avatar_url IS NOT NULL AND NEW.avatar_url <> '')
      -- languages (at least one language)
      AND (NEW.languages IS NOT NULL AND NEW.languages <> '')
      -- specialty (for guide) / tour_types (for agency) / specialty fallback
      AND (
        (NEW.role = 'agency' AND (
          (NEW.tour_types IS NOT NULL AND array_length(NEW.tour_types, 1) > 0)
          OR (NEW.specialties IS NOT NULL AND array_length(NEW.specialties, 1) > 0)
          OR (NEW.specialty IS NOT NULL AND NEW.specialty <> '')
        ))
        OR
        (NEW.role = 'guide' AND (
          (NEW.specialty IS NOT NULL AND NEW.specialty <> '')
          OR (NEW.specialties IS NOT NULL AND array_length(NEW.specialties, 1) > 0)
        ))
      )
      -- license_url uploaded AND license_status = 'verified'
      AND (NEW.license_url IS NOT NULL AND NEW.license_url <> '')
      AND (NEW.license_status = 'verified')
      -- gallery_images: at least 1 photo (the column stores a JSON/text array)
      AND (
        NEW.gallery_images IS NOT NULL
        AND jsonb_array_length(NEW.gallery_images::jsonb) >= 1
      )
    );
  ELSE
    -- For admins / travelers we leave profile_completed as null or whatever
    -- it currently is; the trigger won't force it.
    NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Trigger: run check_profile_completed BEFORE INSERT OR UPDATE on profiles
DROP TRIGGER IF EXISTS trg_profile_completed ON profiles;
CREATE TRIGGER trg_profile_completed
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_profile_completed();

-- 5. Backfill existing rows so current data is consistent immediately
UPDATE profiles
  SET profile_completed = true
  WHERE role IN ('guide', 'agency')
    AND full_name IS NOT NULL AND full_name <> ''
    AND phone IS NOT NULL AND phone <> ''
    AND city IS NOT NULL AND city <> ''
    AND bio IS NOT NULL AND length(bio) >= 50
    AND avatar_url IS NOT NULL AND avatar_url <> ''
    AND languages IS NOT NULL AND languages <> ''
    AND (
      specialty IS NOT NULL AND specialty <> ''
      OR (specialties IS NOT NULL AND array_length(specialties, 1) > 0)
    )
    AND license_url IS NOT NULL AND license_url <> ''
    AND license_status = 'verified'
    AND gallery_images IS NOT NULL
    AND jsonb_array_length(gallery_images::jsonb) >= 1;

-- For everyone else (admins, travelers, incomplete profiles)
UPDATE profiles
  SET profile_completed = false
  WHERE role IN ('guide', 'agency') AND profile_completed IS NOT TRUE;
