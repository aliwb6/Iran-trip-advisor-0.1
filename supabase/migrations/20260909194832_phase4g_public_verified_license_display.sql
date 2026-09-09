-- Phase 4G: publish only the exact reviewed license object for an eligible
-- public provider. The `licenses` bucket itself remains private.

CREATE OR REPLACE FUNCTION private.is_public_verified_license_object(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p_object_name IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.role IN ('guide', 'agency')
        AND p.is_approved IS TRUE
        AND p.is_rejected IS NOT TRUE
        AND p.is_published IS TRUE
        AND p.is_public IS TRUE
        AND p.license_status = 'verified'
        AND p.license_url = p_object_name
    );
$$;

REVOKE ALL ON FUNCTION private.is_public_verified_license_object(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_public_verified_license_object(text)
  TO anon, authenticated, service_role;

-- A signed-URL request is the only browser operation this public policy
-- permits. Listing remains excluded, so callers cannot enumerate the private
-- bucket.
DROP POLICY IF EXISTS licenses_public_select_verified_provider ON storage.objects;
CREATE POLICY licenses_public_select_verified_provider
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'licenses'
  AND storage.allow_only_operation('storage.object.sign')
  AND private.is_public_verified_license_object(name)
);

-- Preserve the existing public allowlist and append a semantic, conditional
-- path instead of exposing the raw private `profiles.license_url` field.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true)
AS
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
    THEN license_url
    ELSE NULL
  END AS public_license_path
FROM public.profiles
WHERE role IN ('guide', 'agency')
  AND is_public IS TRUE
  AND is_published IS TRUE
  AND is_approved IS TRUE;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

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
    accept_bookings, currency, timezone, license_status, created_at, updated_at,
    public_license_path
  FROM public.public_profiles
  WHERE role IN ('guide', 'agency')
    AND is_public IS TRUE
    AND is_published IS TRUE
    AND is_approved IS TRUE;
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
