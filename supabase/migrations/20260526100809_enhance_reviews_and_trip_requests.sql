-- ── Reviews ────────────────────────────────────────────────────────────────
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_id  UUID REFERENCES profiles(id);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS agency_id    UUID REFERENCES agencies(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS title        TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS body         TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tour_title   TEXT;

-- ── Trip Requests ──────────────────────────────────────────────────────────
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS traveler_id          UUID REFERENCES profiles(id);
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS guide_id             UUID REFERENCES guides(id);
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS agency_id            UUID REFERENCES agencies(id);
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS destination_city     TEXT;
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS adult_count          INTEGER DEFAULT 1;
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS child_count          INTEGER DEFAULT 0;
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS language             TEXT;
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS needs_transport      BOOLEAN DEFAULT false;
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS needs_accommodation  BOOLEAN DEFAULT false;
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS traveler_name        TEXT;
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS traveler_email       TEXT;
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS traveler_phone       TEXT;
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS traveler_country     TEXT;

-- Widen status constraint to include 'accepted' / 'rejected' / 'completed'
ALTER TABLE trip_requests DROP CONSTRAINT IF EXISTS trip_requests_status_check;
ALTER TABLE trip_requests ADD CONSTRAINT trip_requests_status_check
  CHECK (status IN ('active', 'pending', 'accepted', 'rejected', 'completed', 'cancelled'));

-- ── Tours — add missing columns ────────────────────────────────────────────
ALTER TABLE tours ADD COLUMN IF NOT EXISTS guide_id           UUID REFERENCES guides(id);
ALTER TABLE tours ADD COLUMN IF NOT EXISTS agency_id          UUID REFERENCES agencies(id);
ALTER TABLE tours ADD COLUMN IF NOT EXISTS price_per_group    NUMERIC;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS price_per_person   NUMERIC;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS max_people         INTEGER;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS tour_type          TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS specialty          TEXT[];
ALTER TABLE tours ADD COLUMN IF NOT EXISTS cover_image_url    TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS duration_hours     INTEGER;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();
