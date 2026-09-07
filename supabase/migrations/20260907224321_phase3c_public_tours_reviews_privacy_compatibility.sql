-- Restore public tours/reviews compatibility after final profile privacy lockdown
-- without reopening raw profile access.

-- 1) Public tours: remove the legacy PUBLIC ALL policy that referenced profiles.
-- Because permissive RLS policies are combined during evaluation, its profile
-- subquery could raise permission denied for anon even when the published-tour
-- SELECT policy was otherwise satisfied.
DROP POLICY IF EXISTS "Owner manages own tours" ON public.tours;
DROP POLICY IF EXISTS "Authenticated owners manage own tours" ON public.tours;
CREATE POLICY "Authenticated owners manage own tours"
ON public.tours
FOR ALL
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  OR public.current_user_is_admin()
)
WITH CHECK (
  owner_id = (SELECT auth.uid())
  OR public.current_user_is_admin()
);

-- 2) Review target validation must not rely on the caller being able to SELECT
-- another user's raw profile row after profile privacy lockdown.
CREATE OR REPLACE FUNCTION public.is_reviewable_profile_target(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_profile_id
      AND p.role IN ('guide', 'agency')
  );
$$;

REVOKE ALL ON FUNCTION public.is_reviewable_profile_target(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_reviewable_profile_target(uuid) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users submit pending reviews" ON public.reviews;
CREATE POLICY "Authenticated users submit pending reviews"
ON public.reviews
FOR INSERT
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
  AND (profile_id IS NULL OR public.is_reviewable_profile_target(profile_id))
  AND (
    tour_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.tours target_tour
      WHERE target_tour.id = reviews.tour_id
    )
  )
);

-- 3) Public review read RPC: safely exposes reviewer display name without a
-- PostgREST embed against raw profiles (which is intentionally locked down).
CREATE OR REPLACE FUNCTION public.get_public_profile_reviews(p_profile_id uuid)
RETURNS TABLE (
  id uuid,
  profile_id uuid,
  rating integer,
  review_text text,
  title text,
  admin_reply text,
  reviewer_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    r.id,
    r.profile_id,
    r.rating,
    r.review_text,
    r.title,
    r.admin_reply,
    COALESCE(NULLIF(btrim(r.reviewer_name), ''), NULLIF(btrim(p.full_name), ''), 'Anonymous') AS reviewer_name,
    r.created_at
  FROM public.reviews r
  LEFT JOIN public.profiles p ON p.id = r.reviewer_id
  WHERE r.profile_id = p_profile_id
    AND r.status = 'approved'
  ORDER BY r.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_reviews(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_reviews(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';