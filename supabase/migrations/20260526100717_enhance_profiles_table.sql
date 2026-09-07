-- Widen the role constraint to accept 'traveler' alongside legacy 'tourist'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('tourist', 'traveler', 'guide', 'agency', 'admin'));

-- Rename default from tourist → traveler for new signups
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'traveler';

-- Missing columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_url        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_status     TEXT DEFAULT 'not_uploaded';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_published       BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialties        TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialty          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS price_per_day      NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_city       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS other_cities       TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guide_since        INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS established_year   INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tour_types         TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_id         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_number     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS review_count       INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rating             NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();

-- Add license_status constraint (will be skipped if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_license_status_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_license_status_check
      CHECK (license_status IN ('not_uploaded', 'pending_review', 'verified'));
  END IF;
END$$;
