
-- ── 1. notifications table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type               text        NOT NULL DEFAULT 'info',
  message            text        NOT NULL,
  related_request_id uuid        REFERENCES trip_requests(id) ON DELETE SET NULL,
  is_read            boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own"
  ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_auth"
  ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notif_update_own"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ── 2. Widen trip_requests.status constraint ──────────────────────────────────
ALTER TABLE trip_requests
  DROP CONSTRAINT IF EXISTS trip_requests_status_check;
ALTER TABLE trip_requests
  ADD CONSTRAINT trip_requests_status_check
  CHECK (status = ANY (ARRAY[
    'active','pending','accepted','rejected','completed','cancelled',
    'proposals_ready','confirmed'
  ]));

-- ── 3. selected_guide_id column ───────────────────────────────────────────────
ALTER TABLE trip_requests
  ADD COLUMN IF NOT EXISTS selected_guide_id uuid REFERENCES profiles(id);

-- ── 4. Guides can SELECT open trip_requests ───────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_requests' AND policyname = 'guides_see_open_requests'
  ) THEN
    CREATE POLICY "guides_see_open_requests"
      ON trip_requests FOR SELECT
      USING (
        status IN ('active','pending')
        AND EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid() AND p.role IN ('guide','agency')
        )
      );
  END IF;
END $$;

-- ── 5. Travelers can see slots via user_id (not only traveler_id) ─────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_slots' AND policyname = 'users_see_own_request_slots'
  ) THEN
    CREATE POLICY "users_see_own_request_slots"
      ON trip_slots FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM trip_requests tr
          WHERE tr.id = trip_slots.trip_request_id
            AND (tr.traveler_id = auth.uid() OR tr.user_id = auth.uid())
        )
      );
  END IF;
END $$;

-- ── 6. Trigger: after guide inserts slot → maybe mark proposals_ready ─────────
CREATE OR REPLACE FUNCTION handle_trip_slot_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count   integer;
  v_req     trip_requests%ROWTYPE;
  v_tourist uuid;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM trip_slots
   WHERE trip_request_id = NEW.trip_request_id
     AND status != 'rejected';

  IF v_count >= 3 THEN
    UPDATE trip_requests
       SET status = 'proposals_ready'
     WHERE id = NEW.trip_request_id
       AND status IN ('active','pending');

    SELECT * INTO v_req FROM trip_requests WHERE id = NEW.trip_request_id;
    v_tourist := COALESCE(v_req.user_id, v_req.traveler_id);

    IF v_tourist IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, message, related_request_id)
      VALUES (
        v_tourist, 'proposals_ready',
        '3 guides are ready for your trip to ' ||
          COALESCE(v_req.destination,'Iran') ||
          '! Log in to choose your guide.',
        NEW.trip_request_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_trip_slot_insert ON trip_slots;
CREATE TRIGGER on_trip_slot_insert
  AFTER INSERT ON trip_slots
  FOR EACH ROW EXECUTE FUNCTION handle_trip_slot_insert();

-- ── 7. Trigger: after tourist confirms → mark slots + notify guides ───────────
CREATE OR REPLACE FUNCTION handle_trip_request_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slot RECORD;
BEGIN
  IF NEW.status = 'confirmed'
     AND OLD.status != 'confirmed'
     AND NEW.selected_guide_id IS NOT NULL
  THEN
    UPDATE trip_slots SET status = 'selected'
     WHERE trip_request_id = NEW.id
       AND guide_id = NEW.selected_guide_id
       AND status != 'rejected';

    FOR v_slot IN
      SELECT guide_id FROM trip_slots
       WHERE trip_request_id = NEW.id
         AND guide_id != NEW.selected_guide_id
         AND status != 'rejected'
    LOOP
      UPDATE trip_slots SET status = 'rejected'
       WHERE trip_request_id = NEW.id AND guide_id = v_slot.guide_id;

      INSERT INTO notifications (user_id, type, message, related_request_id)
      VALUES (v_slot.guide_id, 'request_filled',
              'A trip request you accepted has been filled by another guide.',
              NEW.id);
    END LOOP;

    INSERT INTO notifications (user_id, type, message, related_request_id)
    VALUES (NEW.selected_guide_id, 'guide_selected',
            'Congratulations! A tourist has selected you as their guide.',
            NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_trip_request_confirmed ON trip_requests;
CREATE TRIGGER on_trip_request_confirmed
  AFTER UPDATE ON trip_requests
  FOR EACH ROW EXECUTE FUNCTION handle_trip_request_confirmed();

-- ── 8. Trigger: notify all guides when a new trip request is created ──────────
CREATE OR REPLACE FUNCTION handle_new_trip_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_guide RECORD;
BEGIN
  FOR v_guide IN SELECT id FROM profiles WHERE role IN ('guide','agency') LOOP
    INSERT INTO notifications (user_id, type, message, related_request_id)
    VALUES (
      v_guide.id, 'new_request',
      'New trip request to ' || COALESCE(NEW.destination,'Iran') ||
        ' — be one of the first 3 guides to accept!',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_trip_request ON trip_requests;
CREATE TRIGGER on_new_trip_request
  AFTER INSERT ON trip_requests
  FOR EACH ROW EXECUTE FUNCTION handle_new_trip_request();
