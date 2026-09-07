CREATE TABLE IF NOT EXISTS agencies (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES profiles(id) ON DELETE CASCADE,
  agency_name       TEXT,
  bio               TEXT,
  logo_url          TEXT,
  avatar_url        TEXT,
  phone_number      TEXT,
  headquarters_city TEXT,
  city              TEXT,
  other_cities      TEXT[],
  languages         TEXT[],
  specialty         TEXT[],
  tour_types        TEXT[],
  established_year  INTEGER,
  guide_since       INTEGER,
  price_range       TEXT,
  rating            NUMERIC DEFAULT 0,
  review_count      INTEGER DEFAULT 0,
  license_url       TEXT,
  license_id        TEXT,
  license_status    TEXT DEFAULT 'not_uploaded'
    CHECK (license_status IN ('not_uploaded', 'pending_review', 'verified')),
  is_published      BOOLEAN DEFAULT false,
  is_verified       BOOLEAN DEFAULT false,
  is_approved       BOOLEAN DEFAULT false,
  website_url       TEXT,
  full_name         TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agencies_user_id        ON agencies(user_id);
CREATE INDEX IF NOT EXISTS idx_agencies_city           ON agencies(headquarters_city);
CREATE INDEX IF NOT EXISTS idx_agencies_license_status ON agencies(license_status);
CREATE INDEX IF NOT EXISTS idx_agencies_is_published   ON agencies(is_published);
