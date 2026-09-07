-- Phase 1C: expose public providers only through an allowlisted RPC.

CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS SETOF public.public_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    id, username, role, full_name, city, primary_city, bio, avatar_url,
    gender, languages, specialties, specialty, price_per_day, other_cities,
    guide_since, established_year, tour_types, rating, review_count,
    is_verified, is_approved, is_published, is_public, gallery_images,
    accept_bookings, currency, timezone, license_status, created_at, updated_at
  FROM public.public_profiles
  WHERE role IN ('guide', 'agency')
    AND is_public IS TRUE
    AND is_published IS TRUE
    AND is_approved IS TRUE;
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO anon, authenticated;

REVOKE SELECT ON TABLE public.profiles FROM anon;

NOTIFY pgrst, 'reload schema';
