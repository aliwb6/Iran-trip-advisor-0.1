-- Phase 4C: finish RLS consolidation on currently-empty legacy/support tables
-- and merge profile owner/admin policies into one policy per action.

-- profiles: one SELECT and one UPDATE policy for owner-or-admin.
DROP POLICY IF EXISTS "Admins can select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

ALTER POLICY "Allow select own profile" ON public.profiles
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.current_user_is_admin())
  );

ALTER POLICY "Allow update own profile" ON public.profiles
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.current_user_is_admin())
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR (SELECT public.current_user_is_admin())
  );

-- guides legacy table: published rows are public; owner/admin manage authenticated rows.
DROP POLICY IF EXISTS "Admin full access to guides" ON public.guides;
DROP POLICY IF EXISTS "Guide inserts own row" ON public.guides;
DROP POLICY IF EXISTS "Guide sees own row" ON public.guides;
DROP POLICY IF EXISTS "Guide updates own row" ON public.guides;
DROP POLICY IF EXISTS "Public can read guides" ON public.guides;
DROP POLICY IF EXISTS "Published guides visible to all" ON public.guides;

CREATE POLICY guides_anon_select_published
ON public.guides
FOR SELECT
TO anon
USING (is_published IS TRUE);

CREATE POLICY guides_authenticated_select
ON public.guides
FOR SELECT
TO authenticated
USING (
  is_published IS TRUE
  OR user_id = (SELECT auth.uid())
  OR (SELECT public.current_user_is_admin())
);

CREATE POLICY guides_authenticated_insert
ON public.guides
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR (SELECT public.current_user_is_admin())
);

CREATE POLICY guides_authenticated_update
ON public.guides
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.current_user_is_admin())
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR (SELECT public.current_user_is_admin())
);

CREATE POLICY guides_authenticated_delete
ON public.guides
FOR DELETE
TO authenticated
USING ((SELECT public.current_user_is_admin()));

REVOKE ALL ON TABLE public.guides FROM anon, authenticated;
GRANT SELECT ON TABLE public.guides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guides TO authenticated;

-- agencies legacy table: same contract as guides.
DROP POLICY IF EXISTS "Admin full access to agencies" ON public.agencies;
DROP POLICY IF EXISTS "Agency inserts own row" ON public.agencies;
DROP POLICY IF EXISTS "Agency sees own row" ON public.agencies;
DROP POLICY IF EXISTS "Agency updates own row" ON public.agencies;
DROP POLICY IF EXISTS "Published agencies visible to all" ON public.agencies;

CREATE POLICY agencies_anon_select_published
ON public.agencies
FOR SELECT
TO anon
USING (is_published IS TRUE);

CREATE POLICY agencies_authenticated_select
ON public.agencies
FOR SELECT
TO authenticated
USING (
  is_published IS TRUE
  OR user_id = (SELECT auth.uid())
  OR (SELECT public.current_user_is_admin())
);

CREATE POLICY agencies_authenticated_insert
ON public.agencies
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR (SELECT public.current_user_is_admin())
);

CREATE POLICY agencies_authenticated_update
ON public.agencies
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.current_user_is_admin())
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR (SELECT public.current_user_is_admin())
);

CREATE POLICY agencies_authenticated_delete
ON public.agencies
FOR DELETE
TO authenticated
USING ((SELECT public.current_user_is_admin()));

REVOKE ALL ON TABLE public.agencies FROM anon, authenticated;
GRANT SELECT ON TABLE public.agencies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agencies TO authenticated;

-- articles: public approved/published; authors own pending work; admin full management.
DROP POLICY IF EXISTS "Admin full access" ON public.articles;
DROP POLICY IF EXISTS "Authenticated can insert" ON public.articles;
DROP POLICY IF EXISTS "Author sees own articles" ON public.articles;
DROP POLICY IF EXISTS "Author updates own pending" ON public.articles;
DROP POLICY IF EXISTS articles_public_read_approved ON public.articles;

CREATE POLICY articles_anon_select
ON public.articles
FOR SELECT
TO anon
USING (status = 'approved' AND is_published IS TRUE);

CREATE POLICY articles_authenticated_select
ON public.articles
FOR SELECT
TO authenticated
USING (
  (status = 'approved' AND is_published IS TRUE)
  OR author_id = (SELECT auth.uid())
  OR (SELECT public.current_user_is_admin())
);

CREATE POLICY articles_authenticated_insert
ON public.articles
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = (SELECT auth.uid())
  OR (SELECT public.current_user_is_admin())
);

CREATE POLICY articles_authenticated_update
ON public.articles
FOR UPDATE
TO authenticated
USING (
  (author_id = (SELECT auth.uid()) AND status = 'pending')
  OR (SELECT public.current_user_is_admin())
)
WITH CHECK (
  (author_id = (SELECT auth.uid()) AND status = 'pending')
  OR (SELECT public.current_user_is_admin())
);

CREATE POLICY articles_authenticated_delete
ON public.articles
FOR DELETE
TO authenticated
USING ((SELECT public.current_user_is_admin()));

REVOKE ALL ON TABLE public.articles FROM anon, authenticated;
GRANT SELECT ON TABLE public.articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.articles TO authenticated;

-- tour_requests: authenticated participants only; no anonymous access.
DROP POLICY IF EXISTS "guide updates received request" ON public.tour_requests;
DROP POLICY IF EXISTS "see own requests" ON public.tour_requests;
DROP POLICY IF EXISTS "tourist creates own request" ON public.tour_requests;
DROP POLICY IF EXISTS "tourist updates own request" ON public.tour_requests;

CREATE POLICY tour_requests_authenticated_select
ON public.tour_requests
FOR SELECT
TO authenticated
USING (
  tourist_id = (SELECT auth.uid())
  OR guide_id = (SELECT auth.uid())
);

CREATE POLICY tour_requests_authenticated_insert
ON public.tour_requests
FOR INSERT
TO authenticated
WITH CHECK (tourist_id = (SELECT auth.uid()));

CREATE POLICY tour_requests_authenticated_update
ON public.tour_requests
FOR UPDATE
TO authenticated
USING (
  tourist_id = (SELECT auth.uid())
  OR guide_id = (SELECT auth.uid())
)
WITH CHECK (
  tourist_id = (SELECT auth.uid())
  OR guide_id = (SELECT auth.uid())
);

REVOKE ALL ON TABLE public.tour_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tour_requests TO authenticated;

NOTIFY pgrst, 'reload schema';