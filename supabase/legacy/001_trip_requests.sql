-- Trip Request Automation System
-- NOTE: If a trip_requests table already exists with a different schema,
-- rename or drop it before running this migration.

CREATE TABLE IF NOT EXISTS trip_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  traveler_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  travel_dates JSONB,
  interests TEXT[],
  group_size INT DEFAULT 1,
  budget_range TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  slot_count INT DEFAULT 0,
  broadcast_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trip_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_request_id UUID REFERENCES trip_requests(id) NOT NULL,
  guide_id UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'chatting',
  accepted_at TIMESTAMPTZ DEFAULT now(),
  finalized_at TIMESTAMPTZ,
  UNIQUE(trip_request_id, guide_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_requests_status ON trip_requests(status);
CREATE INDEX IF NOT EXISTS idx_trip_requests_traveler ON trip_requests(traveler_id);
CREATE INDEX IF NOT EXISTS idx_trip_slots_request ON trip_slots(trip_request_id);
CREATE INDEX IF NOT EXISTS idx_trip_slots_guide ON trip_slots(guide_id);

ALTER TABLE trip_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_slots ENABLE ROW LEVEL SECURITY;

-- Travelers can see and create their own requests
CREATE POLICY "travelers_own_requests" ON trip_requests
  FOR ALL USING (auth.uid() = traveler_id);

-- Guides can see pending/active requests with slots < 3
CREATE POLICY "guides_see_available" ON trip_requests
  FOR SELECT USING (slot_count < 3 AND status IN ('pending', 'active'));

-- Guides manage their own slots
CREATE POLICY "guides_own_slots" ON trip_slots
  FOR ALL USING (auth.uid() = guide_id);

-- Travelers can see slots on their requests
CREATE POLICY "travelers_see_slots" ON trip_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_requests
      WHERE id = trip_request_id AND traveler_id = auth.uid()
    )
  );
