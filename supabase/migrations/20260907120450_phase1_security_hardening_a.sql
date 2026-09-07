-- Phase 1A: restrict public reads to purpose-built public surfaces and remove
-- browser access to privileged notification/trigger helper functions.

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  username,
  role,
  full_name,
  city,
  primary_city,
  bio,
  avatar_url,
  gender,
  languages,
  specialties,
  specialty,
  price_per_day,
  other_cities,
  guide_since,
  established_year,
  tour_types,
  rating,
  review_count,
  is_verified,
  is_approved,
  is_published,
  is_public,
  gallery_images,
  accept_bookings,
  currency,
  timezone,
  license_status,
  created_at,
  updated_at
FROM public.profiles
WHERE role IN ('guide', 'agency')
  AND is_public IS TRUE
  AND is_published IS TRUE
  AND is_approved IS TRUE;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

DROP POLICY IF EXISTS service_insert_notifications ON public.notifications;
DROP POLICY IF EXISTS notif_insert_auth ON public.notifications;
DROP POLICY IF EXISTS notif_select_own ON public.notifications;
DROP POLICY IF EXISTS "read own notifications" ON public.notifications;
DROP POLICY IF EXISTS users_see_own_notifications ON public.notifications;
DROP POLICY IF EXISTS notif_update_own ON public.notifications;
DROP POLICY IF EXISTS "update own notifications" ON public.notifications;
DROP POLICY IF EXISTS users_update_own_notifications ON public.notifications;
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;

CREATE POLICY notifications_select_own
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY notifications_update_own
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE INSERT ON TABLE public.notifications FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'handle_new_user',
        'handle_new_trip_request',
        'handle_trip_request_confirmed',
        'handle_trip_slot_insert',
        'notify_guides_new_request',
        'notify_on_guide_selected',
        'notify_on_message',
        'set_username_if_empty',
        'is_admin',
        'set_updated_at',
        'update_guide_rating',
        'update_agency_rating'
      ])
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path TO public', fn.proname, fn.args);
  END LOOP;

  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'handle_new_user',
        'handle_new_trip_request',
        'handle_trip_request_confirmed',
        'handle_trip_slot_insert',
        'notify_guides_new_request',
        'notify_on_guide_selected',
        'notify_on_message',
        'set_username_if_empty'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', fn.proname, fn.args);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "Public can read tours" ON public.tours;
DROP POLICY IF EXISTS "Published tours visible to all" ON public.tours;
DROP POLICY IF EXISTS "anyone can view published tours" ON public.tours;
DROP POLICY IF EXISTS "owners can view own tours" ON public.tours;
DROP POLICY IF EXISTS tours_public_read_published ON public.tours;
DROP POLICY IF EXISTS tours_owner_read_own ON public.tours;

CREATE POLICY tours_public_read_published
  ON public.tours FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR (status = 'active' AND is_active IS TRUE));

CREATE POLICY tours_owner_read_own
  ON public.tours FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Public can read articles" ON public.articles;
DROP POLICY IF EXISTS "Public read approved" ON public.articles;
DROP POLICY IF EXISTS articles_public_read_approved ON public.articles;

CREATE POLICY articles_public_read_approved
  ON public.articles FOR SELECT
  TO anon, authenticated
  USING (status = 'approved' AND is_published IS TRUE);
