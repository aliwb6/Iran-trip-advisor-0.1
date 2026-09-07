-- Add columns that align guides table with new schema
ALTER TABLE guides ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS full_name         TEXT;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS bio               TEXT;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS avatar_url        TEXT;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS phone_number      TEXT;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS primary_city      TEXT;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS other_cities      TEXT[];
ALTER TABLE guides ADD COLUMN IF NOT EXISTS specialty         TEXT[];
ALTER TABLE guides ADD COLUMN IF NOT EXISTS years_experience  INTEGER;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS guide_since       INTEGER;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS price_per_day     NUMERIC;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS license_url       TEXT;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS license_id        TEXT;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS license_status    TEXT DEFAULT 'not_uploaded';
ALTER TABLE guides ADD COLUMN IF NOT EXISTS is_published      BOOLEAN DEFAULT false;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS gender            TEXT;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guides_license_status_check'
  ) THEN
    ALTER TABLE guides ADD CONSTRAINT guides_license_status_check
      CHECK (license_status IN ('not_uploaded', 'pending_review', 'verified'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guides_gender_check'
  ) THEN
    ALTER TABLE guides ADD CONSTRAINT guides_gender_check
      CHECK (gender IN ('male', 'female', 'other'));
  END IF;
END$$;
