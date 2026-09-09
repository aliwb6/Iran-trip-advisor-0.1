-- Phase 4B: consolidate canonical RLS policies, remove redundant permissive
-- policies, optimize auth.uid() evaluation, and reduce browser table grants.

-- ---------------------------------------------------------------------------
-- profiles: keep one owner policy per action plus explicit admin policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS insert_own_profile ON public.profiles;
DROP POLICY IF EXISTS update_own_profile ON public.profiles;

ALTER POLICY "Allow select own profile" ON public.profiles
  TO authenticated
  USING ((SELECT auth.uid()) = id);

ALTER POLICY "Allow update own profile" ON public.profiles
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- tours: one public reader and one authenticated policy per action.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can delete tours" ON public.tours;
DROP POLICY IF EXISTS "Admins can insert tours" ON public.tours;
DROP POLICY IF EXISTS "Admins can update tours" ON public.tours;
DROP POLICY IF EXISTS "Authenticated owners manage own tours" ON public.tours;
DROP POLICY IF EXISTS "owners can create tours" ON public.tours;
DROP POLICY IF EXISTS "owners can update own tours" ON public.tours;
DROP POLICY IF EXISTS tours_owner_read_own ON public.tours;
DROP POLICY IF EXISTS tours_public_read_published ON public.tours;

CREATE POLICY tours_anon_read_published
ON public.tours
FOR SELECT
TO anon
USING (status = 'published' OR (status = 'active' AND is_active IS TRUE));

CREATE POLICY tours_authenticated_read
ON public.tours
FOR SELECT
TO authenticated
USING (
  status = 'published'
  OR (status = 'active' AND is_active IS TRUE)
  OR owner_id = (SELECT auth.uid())
  OR public.current_user_is_admin()
);

CREATE POLICY tours_authenticated_insert
ON public.tours
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = (SELECT auth.uid())
  OR public.current_user_is_admin()
);

CREATE POLICY tours_authenticated_update
ON public.tours
FOR UPDATE
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  OR public.current_user_is_admin()
)
WITH CHECK (
  owner_id = (SELECT auth.uid())
  OR public.current_user_is_admin()
);

CREATE POLICY tours_authenticated_delete
ON public.tours
FOR DELETE
TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  OR public.current_user_is_admin()
);

REVOKE ALL ON TABLE public.tours FROM anon, authenticated;
GRANT SELECT ON TABLE public.tours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tours TO authenticated;

-- ---------------------------------------------------------------------------
-- trip_requests: authenticated-only direct access with a single SELECT policy.
-- Lifecycle fields remain protected by the Phase 2 triggers/RPCs.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS guides_see_active_requests ON public.trip_requests;
DROP POLICY IF EXISTS users_insert_own_requests ON public.trip_requests;
DROP POLICY IF EXISTS users_see_own_requests ON public.trip_requests;
DROP POLICY IF EXISTS users_update_own_requests ON public.trip_requests;

CREATE POLICY trip_requests_authenticated_select
ON public.trip_requests
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (
    status IN ('active','pending','open','proposals_ready')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('guide','agency')
    )
  )
);

CREATE POLICY trip_requests_authenticated_insert
ON public.trip_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY trip_requests_authenticated_update
ON public.trip_requests
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.trip_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.trip_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- trip_slots: collapse duplicate guide/tourist policies by action.
-- Direct DELETE stays unavailable; proposal history is retained by design.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS guides_insert_slots ON public.trip_slots;
DROP POLICY IF EXISTS guides_own_slots ON public.trip_slots;
DROP POLICY IF EXISTS guides_see_own_slots ON public.trip_slots;
DROP POLICY IF EXISTS guides_update_own_slots ON public.trip_slots;
DROP POLICY IF EXISTS tourists_see_slots_for_their_requests ON public.trip_slots;
DROP POLICY IF EXISTS tourists_update_slots_for_their_requests ON public.trip_slots;

CREATE POLICY trip_slots_authenticated_select
ON public.trip_slots
FOR SELECT
TO authenticated
USING (
  guide_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.trip_requests tr
    WHERE tr.id = trip_slots.trip_request_id
      AND tr.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY trip_slots_authenticated_insert
ON public.trip_slots
FOR INSERT
TO authenticated
WITH CHECK (
  guide_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('guide','agency')
  )
);

CREATE POLICY trip_slots_authenticated_update
ON public.trip_slots
FOR UPDATE
TO authenticated
USING (
  guide_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.trip_requests tr
    WHERE tr.id = trip_slots.trip_request_id
      AND tr.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  guide_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.trip_requests tr
    WHERE tr.id = trip_slots.trip_request_id
      AND tr.user_id = (SELECT auth.uid())
  )
);

REVOKE ALL ON TABLE public.trip_slots FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.trip_slots TO authenticated;

-- ---------------------------------------------------------------------------
-- conversations: owner-only, authenticated-only.
-- ---------------------------------------------------------------------------
ALTER POLICY "Users see own conversations" ON public.conversations
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.conversations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.conversations TO authenticated;

-- ---------------------------------------------------------------------------
-- messages: one policy per action, with admin added only to SELECT.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins read all messages" ON public.messages;
DROP POLICY IF EXISTS "Users see own messages" ON public.messages;

CREATE POLICY messages_authenticated_select
ON public.messages
FOR SELECT
TO authenticated
USING (
  public.current_user_is_admin()
  OR sender_id = (SELECT auth.uid())
  OR receiver_id = (SELECT auth.uid())
  OR (
    conversation_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY messages_authenticated_insert
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  OR (
    conversation_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY messages_authenticated_update
ON public.messages
FOR UPDATE
TO authenticated
USING (
  sender_id = (SELECT auth.uid())
  OR receiver_id = (SELECT auth.uid())
  OR (
    conversation_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
)
WITH CHECK (
  sender_id = (SELECT auth.uid())
  OR receiver_id = (SELECT auth.uid())
  OR (
    conversation_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY messages_authenticated_delete
ON public.messages
FOR DELETE
TO authenticated
USING (
  sender_id = (SELECT auth.uid())
  OR receiver_id = (SELECT auth.uid())
  OR (
    conversation_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
);

REVOKE ALL ON TABLE public.messages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messages TO authenticated;

-- ---------------------------------------------------------------------------
-- reviews: one anonymous SELECT and one authenticated SELECT policy.
-- Existing insert/moderation policies are preserved.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can read all reviews" ON public.reviews;
DROP POLICY IF EXISTS "Approved reviews are public" ON public.reviews;
DROP POLICY IF EXISTS "Reviewers can read own reviews" ON public.reviews;

CREATE POLICY reviews_anon_select_approved
ON public.reviews
FOR SELECT
TO anon
USING (status = 'approved');

CREATE POLICY reviews_authenticated_select
ON public.reviews
FOR SELECT
TO authenticated
USING (
  status = 'approved'
  OR reviewer_id = (SELECT auth.uid())
  OR public.current_user_is_admin()
);

-- ---------------------------------------------------------------------------
-- site_settings: public read, admin-only writes, no overlapping ALL policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS site_settings_admin_write ON public.site_settings;
DROP POLICY IF EXISTS site_settings_public_read ON public.site_settings;

CREATE POLICY site_settings_anon_read
ON public.site_settings
FOR SELECT
TO anon
USING (true);

CREATE POLICY site_settings_authenticated_read
ON public.site_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY site_settings_admin_insert
ON public.site_settings
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_is_admin());

CREATE POLICY site_settings_admin_update
ON public.site_settings
FOR UPDATE
TO authenticated
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

CREATE POLICY site_settings_admin_delete
ON public.site_settings
FOR DELETE
TO authenticated
USING (public.current_user_is_admin());

REVOKE ALL ON TABLE public.site_settings FROM anon, authenticated;
GRANT SELECT ON TABLE public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_settings TO authenticated;

-- ---------------------------------------------------------------------------
-- homepage_destinations: public active rows, admin full management.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS homepage_destinations_admin_all ON public.homepage_destinations;
DROP POLICY IF EXISTS homepage_destinations_public_active ON public.homepage_destinations;

CREATE POLICY homepage_destinations_anon_select
ON public.homepage_destinations
FOR SELECT
TO anon
USING (is_active IS TRUE);

CREATE POLICY homepage_destinations_authenticated_select
ON public.homepage_destinations
FOR SELECT
TO authenticated
USING (is_active IS TRUE OR public.current_user_is_admin());

CREATE POLICY homepage_destinations_admin_insert
ON public.homepage_destinations
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_is_admin());

CREATE POLICY homepage_destinations_admin_update
ON public.homepage_destinations
FOR UPDATE
TO authenticated
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

CREATE POLICY homepage_destinations_admin_delete
ON public.homepage_destinations
FOR DELETE
TO authenticated
USING (public.current_user_is_admin());

REVOKE ALL ON TABLE public.homepage_destinations FROM anon, authenticated;
GRANT SELECT ON TABLE public.homepage_destinations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.homepage_destinations TO authenticated;

NOTIFY pgrst, 'reload schema';