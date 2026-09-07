-- ── Auto-update guide rating on review insert/update/delete ──────────────────
CREATE OR REPLACE FUNCTION update_guide_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  target_id := COALESCE(NEW.guide_id, OLD.guide_id);
  IF target_id IS NOT NULL THEN
    UPDATE guides SET
      rating       = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE guide_id = target_id), 0),
      review_count = (SELECT COUNT(*) FROM reviews WHERE guide_id = target_id),
      updated_at   = NOW()
    WHERE id = target_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guide_rating_insert ON reviews;
DROP TRIGGER IF EXISTS trg_guide_rating_update ON reviews;
DROP TRIGGER IF EXISTS trg_guide_rating_delete ON reviews;

CREATE TRIGGER trg_guide_rating_insert
  AFTER INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION update_guide_rating();
CREATE TRIGGER trg_guide_rating_update
  AFTER UPDATE OF rating ON reviews FOR EACH ROW EXECUTE FUNCTION update_guide_rating();
CREATE TRIGGER trg_guide_rating_delete
  AFTER DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION update_guide_rating();

-- ── Auto-update agency rating ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_agency_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  target_id := COALESCE(NEW.agency_id, OLD.agency_id);
  IF target_id IS NOT NULL THEN
    UPDATE agencies SET
      rating       = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE agency_id = target_id), 0),
      review_count = (SELECT COUNT(*) FROM reviews WHERE agency_id = target_id),
      updated_at   = NOW()
    WHERE id = target_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agency_rating_insert ON reviews;
DROP TRIGGER IF EXISTS trg_agency_rating_update ON reviews;
DROP TRIGGER IF EXISTS trg_agency_rating_delete ON reviews;

CREATE TRIGGER trg_agency_rating_insert
  AFTER INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION update_agency_rating();
CREATE TRIGGER trg_agency_rating_update
  AFTER UPDATE OF rating ON reviews FOR EACH ROW EXECUTE FUNCTION update_agency_rating();
CREATE TRIGGER trg_agency_rating_delete
  AFTER DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION update_agency_rating();

-- ── Auto-set updated_at on profiles/guides/agencies ───────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_guides_updated_at ON guides;
CREATE TRIGGER trg_guides_updated_at
  BEFORE UPDATE ON guides FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_agencies_updated_at ON agencies;
CREATE TRIGGER trg_agencies_updated_at
  BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tours_updated_at ON tours;
CREATE TRIGGER trg_tours_updated_at
  BEFORE UPDATE ON tours FOR EACH ROW EXECUTE FUNCTION set_updated_at();
