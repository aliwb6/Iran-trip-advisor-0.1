-- Public verified-license previews for approved provider profiles.
-- The licenses bucket stays private. Only the exact verified document referenced
-- by an approved, published, public guide/agency can be selected by public roles.

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
  updated_at,
  CASE
    WHEN role IN ('guide', 'agency')
      AND is_approved IS TRUE
      AND is_rejected IS NOT TRUE
      AND is_published IS TRUE
      AND is_public IS TRUE
      AND license_status = 'verified'
      AND NULLIF(btrim(license_url), '') IS NOT NULL
    THEN license_url
    ELSE NULL
  END AS public_license_path
FROM public.profiles
WHERE role IN ('guide', 'agency')
  AND is_public IS TRUE
  AND is_published IS TRUE
  AND is_approved IS TRUE
  AND is_rejected IS NOT TRUE;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS SETOF public.public_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pp.id,
    pp.username,
    pp.role,
    pp.full_name,
    pp.city,
    pp.primary_city,
    pp.bio,
    pp.avatar_url,
    pp.gender,
    pp.languages,
    pp.specialties,
    pp.specialty,
    pp.price_per_day,
    pp.other_cities,
    pp.guide_since,
    pp.established_year,
    pp.tour_types,
    pp.rating,
    pp.review_count,
    pp.is_verified,
    pp.is_approved,
    pp.is_published,
    pp.is_public,
    pp.gallery_images,
    pp.accept_bookings,
    pp.currency,
    pp.timezone,
    pp.license_status,
    pp.created_at,
    pp.updated_at,
    pp.public_license_path
  FROM public.public_profiles AS pp;
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO anon, authenticated;
REVOKE SELECT ON TABLE public.profiles FROM anon;

CREATE INDEX IF NOT EXISTS idx_profiles_public_verified_license_url
ON public.profiles (license_url)
WHERE role IN ('guide', 'agency')
  AND is_approved IS TRUE
  AND is_rejected IS NOT TRUE
  AND is_published IS TRUE
  AND is_public IS TRUE
  AND license_status = 'verified'
  AND license_url IS NOT NULL;

DROP POLICY IF EXISTS "Public reads approved verified licenses" ON storage.objects;
DROP POLICY IF EXISTS licenses_public_verified_select ON storage.objects;

CREATE POLICY licenses_public_verified_select
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'licenses'
  AND EXISTS (
    SELECT 1
    FROM public.public_profiles AS pp
    WHERE pp.public_license_path = storage.objects.name
      AND pp.license_status = 'verified'
  )
);

NOTIFY pgrst, 'reload schema';
