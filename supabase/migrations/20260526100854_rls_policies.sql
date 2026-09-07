-- ── Enable RLS (idempotent) ───────────────────────────────────────────────────
ALTER TABLE agencies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_requests ENABLE ROW LEVEL SECURITY;

-- ── Drop then re-create to keep idempotent ────────────────────────────────────

-- PROFILES
DROP POLICY IF EXISTS "Public profiles viewable by all"  ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"     ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile"     ON profiles;

CREATE POLICY "Public profiles viewable by all"
  ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- GUIDES
DROP POLICY IF EXISTS "Published guides visible to all" ON guides;
DROP POLICY IF EXISTS "Guide sees own row"              ON guides;
DROP POLICY IF EXISTS "Guide updates own row"           ON guides;
DROP POLICY IF EXISTS "Guide inserts own row"           ON guides;
DROP POLICY IF EXISTS "Admin full access to guides"     ON guides;

CREATE POLICY "Published guides visible to all"
  ON guides FOR SELECT USING (is_published = true);
CREATE POLICY "Guide sees own row"
  ON guides FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Guide updates own row"
  ON guides FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Guide inserts own row"
  ON guides FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin full access to guides"
  ON guides FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

-- AGENCIES
DROP POLICY IF EXISTS "Published agencies visible to all" ON agencies;
DROP POLICY IF EXISTS "Agency sees own row"               ON agencies;
DROP POLICY IF EXISTS "Agency updates own row"            ON agencies;
DROP POLICY IF EXISTS "Agency inserts own row"            ON agencies;
DROP POLICY IF EXISTS "Admin full access to agencies"     ON agencies;

CREATE POLICY "Published agencies visible to all"
  ON agencies FOR SELECT USING (is_published = true);
CREATE POLICY "Agency sees own row"
  ON agencies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Agency updates own row"
  ON agencies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Agency inserts own row"
  ON agencies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin full access to agencies"
  ON agencies FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

-- TOURS
DROP POLICY IF EXISTS "Published tours visible to all"     ON tours;
DROP POLICY IF EXISTS "Owner manages own tours"            ON tours;

CREATE POLICY "Published tours visible to all"
  ON tours FOR SELECT USING (is_active = true OR is_featured = true);
CREATE POLICY "Owner manages own tours"
  ON tours FOR ALL USING (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT user_id FROM guides   WHERE id = tours.guide_id)
    OR auth.uid() IN (SELECT user_id FROM agencies WHERE id = tours.agency_id)
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

-- REVIEWS
DROP POLICY IF EXISTS "Reviews visible to all"          ON reviews;
DROP POLICY IF EXISTS "Logged in users can write review" ON reviews;

CREATE POLICY "Reviews visible to all"
  ON reviews FOR SELECT USING (true);
CREATE POLICY "Logged in users can write review"
  ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id OR reviewer_id IS NULL);

-- TRIP REQUESTS
DROP POLICY IF EXISTS "Traveler sees own requests"         ON trip_requests;
DROP POLICY IF EXISTS "Guide sees requests sent to them"   ON trip_requests;
DROP POLICY IF EXISTS "Agency sees requests sent to them"  ON trip_requests;
DROP POLICY IF EXISTS "Anyone can create a trip request"   ON trip_requests;
DROP POLICY IF EXISTS "Admin sees all requests"            ON trip_requests;

CREATE POLICY "Traveler sees own requests"
  ON trip_requests FOR SELECT USING (
    auth.uid() = traveler_id OR auth.uid() = user_id
  );
CREATE POLICY "Guide sees requests sent to them"
  ON trip_requests FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM guides WHERE id = trip_requests.guide_id)
  );
CREATE POLICY "Agency sees requests sent to them"
  ON trip_requests FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM agencies WHERE id = trip_requests.agency_id)
  );
CREATE POLICY "Anyone can create a trip request"
  ON trip_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin sees all requests"
  ON trip_requests FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );
