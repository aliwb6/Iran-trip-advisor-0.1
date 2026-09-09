-- Keep the public profile view security-invoker and route public access through
-- the already allowlisted SECURITY DEFINER RPC. Storage policy uses that same
-- RPC so anonymous users never need direct privileges on the underlying view.

ALTER VIEW public.public_profiles SET (security_invoker = true);
REVOKE ALL ON TABLE public.public_profiles FROM anon, authenticated;

DROP POLICY IF EXISTS licenses_public_verified_select ON storage.objects;

CREATE POLICY licenses_public_verified_select
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'licenses'
  AND EXISTS (
    SELECT 1
    FROM public.get_public_profiles() AS pp
    WHERE pp.public_license_path = storage.objects.name
      AND pp.license_status = 'verified'
  )
);

NOTIFY pgrst, 'reload schema';
