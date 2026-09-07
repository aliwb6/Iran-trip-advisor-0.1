-- Moderated reviews for profile-backed guides and agencies.
--
-- Public guide and agency routes both use profiles.id. profile_id is therefore
-- the canonical target for those reviews. The legacy guide_id and agency_id
-- columns remain in place for compatibility, but new profile-review writes do
-- not use them.

BEGIN;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS profile_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_profile_id_fkey,
  ADD CONSTRAINT reviews_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS reviews_reviewed_by_fkey,
  ADD CONSTRAINT reviews_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS reviews_status_check,
  ADD CONSTRAINT reviews_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));

-- Backfill legacy guide targets when their corresponding profile can be
-- resolved. Agency reviews are intentionally not guessed from the empty
-- legacy agencies table: without a matching profile relationship there is no
-- safe target to infer. Production currently has no review rows, but this
-- keeps the migration non-destructive in other environments.
UPDATE public.reviews AS review
SET profile_id = profile.id
FROM public.profiles AS profile
WHERE review.profile_id IS NULL
  AND review.guide_id = profile.id
  AND profile.role IN ('guide', 'agency');

UPDATE public.reviews AS review
SET profile_id = profile.id
FROM public.agencies AS agency
JOIN public.profiles AS profile
  ON profile.id = agency.user_id
 AND profile.role = 'agency'
WHERE review.profile_id IS NULL
  AND review.agency_id = agency.id;

-- NOT VALID avoids blocking deployment in an older environment containing a
-- malformed legacy row. PostgreSQL still enforces both checks for new or
-- subsequently updated rows.
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_canonical_target_check,
  ADD CONSTRAINT reviews_canonical_target_check
    CHECK (num_nonnulls(profile_id, tour_id) = 1) NOT VALID,
  DROP CONSTRAINT IF EXISTS reviews_review_text_not_blank,
  ADD CONSTRAINT reviews_review_text_not_blank
    CHECK (NULLIF(btrim(review_text), '') IS NOT NULL) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_reviews_status_created_at
  ON public.reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_profile_status
  ON public.reviews (profile_id, status) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_tour_status
  ON public.reviews (tour_id, status) WHERE tour_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id
  ON public.reviews (reviewer_id) WHERE reviewer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_by
  ON public.reviews (reviewed_by) WHERE reviewed_by IS NOT NULL;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

-- A foreign key proves that the profile exists; this trigger additionally
-- enforces that profile reviews can target only the two public provider roles.
CREATE OR REPLACE FUNCTION private.validate_review_profile_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.profile_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles AS target_profile
       WHERE target_profile.id = NEW.profile_id
         AND target_profile.role IN ('guide', 'agency')
     ) THEN
    RAISE EXCEPTION 'Review target must be a guide or agency profile.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_review_profile_target()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validate_review_profile_target ON public.reviews;
CREATE TRIGGER trg_validate_review_profile_target
  BEFORE INSERT OR UPDATE OF profile_id
  ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_review_profile_target();

-- Reviews are the source of truth. profiles.rating/review_count are cached
-- values maintained from approved reviews only, for both guide and agency
-- profile roles.
CREATE OR REPLACE FUNCTION private.refresh_profile_review_aggregate(
  target_profile_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  average_rating numeric;
  approved_count integer;
BEGIN
  IF target_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(round(avg(review.rating)::numeric, 1), 0), count(*)::integer
    INTO average_rating, approved_count
  FROM public.reviews AS review
  WHERE review.profile_id = target_profile_id
    AND review.status = 'approved';

  UPDATE public.profiles
  SET rating = average_rating,
      review_count = approved_count
  WHERE id = target_profile_id
    AND role IN ('guide', 'agency');
END;
$$;

REVOKE ALL ON FUNCTION private.refresh_profile_review_aggregate(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.sync_profile_review_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.refresh_profile_review_aggregate(OLD.profile_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.profile_id IS DISTINCT FROM NEW.profile_id THEN
    PERFORM private.refresh_profile_review_aggregate(OLD.profile_id);
  END IF;

  PERFORM private.refresh_profile_review_aggregate(NEW.profile_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_profile_review_aggregates()
  FROM PUBLIC, anon, authenticated, service_role;

-- Remove the production triggers that count all statuses and update the old
-- legacy guide/agency tables. Profile aggregates below are now authoritative.
DROP TRIGGER IF EXISTS trg_agency_rating_delete ON public.reviews;
DROP TRIGGER IF EXISTS trg_agency_rating_insert ON public.reviews;
DROP TRIGGER IF EXISTS trg_agency_rating_update ON public.reviews;
DROP TRIGGER IF EXISTS trg_guide_rating_delete ON public.reviews;
DROP TRIGGER IF EXISTS trg_guide_rating_insert ON public.reviews;
DROP TRIGGER IF EXISTS trg_guide_rating_update ON public.reviews;
DROP TRIGGER IF EXISTS trg_sync_review_aggregates ON public.reviews;
DROP TRIGGER IF EXISTS trg_sync_profile_review_aggregates ON public.reviews;

CREATE TRIGGER trg_sync_profile_review_aggregates
  AFTER INSERT OR DELETE OR UPDATE OF status, rating, profile_id
  ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_profile_review_aggregates();

-- Reconcile cached aggregates for any successfully backfilled legacy targets.
DO $$
DECLARE
  target_profile_id uuid;
BEGIN
  FOR target_profile_id IN
    SELECT DISTINCT review.profile_id
    FROM public.reviews AS review
    WHERE review.profile_id IS NOT NULL
  LOOP
    PERFORM private.refresh_profile_review_aggregate(target_profile_id);
  END LOOP;
END;
$$;

-- Replace the former public-all SELECT policy and nullable-reviewer INSERT
-- policy with least-privilege moderated access.
DROP POLICY IF EXISTS "Reviews visible to all" ON public.reviews;
DROP POLICY IF EXISTS "Logged in users can write review" ON public.reviews;
DROP POLICY IF EXISTS "Approved reviews are public" ON public.reviews;
DROP POLICY IF EXISTS "Reviewers can read own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can read all reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can moderate reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users submit pending reviews" ON public.reviews;

CREATE POLICY "Approved reviews are public"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

CREATE POLICY "Reviewers can read own reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (reviewer_id = (SELECT auth.uid()));

CREATE POLICY "Admins can read all reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.profiles AS admin_profile
    WHERE admin_profile.id = (SELECT auth.uid())
      AND (admin_profile.role = 'admin' OR admin_profile.is_admin IS TRUE)
  ));

CREATE POLICY "Authenticated users submit pending reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = (SELECT auth.uid())
    AND status = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND admin_reply IS NULL
    AND reviewer_name IS NULL
    AND reviewer_email IS NULL
    AND body IS NULL
    AND guide_id IS NULL
    AND agency_id IS NULL
    AND rating BETWEEN 1 AND 5
    AND NULLIF(btrim(review_text), '') IS NOT NULL
    AND num_nonnulls(profile_id, tour_id) = 1
    AND (
      profile_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.profiles AS target_profile
        WHERE target_profile.id = profile_id
          AND target_profile.role IN ('guide', 'agency')
      )
    )
    AND (
      tour_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.tours AS target_tour
        WHERE target_tour.id = tour_id
      )
    )
  );

CREATE POLICY "Admins can moderate reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.profiles AS admin_profile
    WHERE admin_profile.id = (SELECT auth.uid())
      AND (admin_profile.role = 'admin' OR admin_profile.is_admin IS TRUE)
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.profiles AS admin_profile
    WHERE admin_profile.id = (SELECT auth.uid())
      AND (admin_profile.role = 'admin' OR admin_profile.is_admin IS TRUE)
  ));

-- Restrict the exposed client roles without changing service_role privileges.
-- The latter is intentionally left alone for operational/admin tooling.
REVOKE ALL ON TABLE public.reviews FROM anon, authenticated;
GRANT SELECT ON TABLE public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.reviews TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
