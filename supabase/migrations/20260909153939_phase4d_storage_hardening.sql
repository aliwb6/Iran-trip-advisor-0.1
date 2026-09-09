-- Phase 4D: harden public image buckets and consolidate storage policies.
-- Keep existing public-read behavior for public assets while bounding upload size/type
-- and limiting writes to the intended authenticated actors.

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[]
WHERE id IN ('tour-images','proposal-images','site-images');

-- Tour images are public assets, but only approved provider-role users or admins
-- should be able to create objects. owner_id is assigned by Storage from the JWT.
DROP POLICY IF EXISTS "Auth users can upload tour images" ON storage.objects;
DROP POLICY IF EXISTS "Providers upload tour images" ON storage.objects;
CREATE POLICY "Providers upload tour images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tour-images'
  AND owner_id = (SELECT auth.uid())::text
  AND (
    (SELECT public.current_user_is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('guide','agency')
    )
  )
);

-- Proposal images follow the same provider-only write contract.
DROP POLICY IF EXISTS "Auth users can upload proposal images" ON storage.objects;
DROP POLICY IF EXISTS "Providers upload proposal images" ON storage.objects;
CREATE POLICY "Providers upload proposal images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proposal-images'
  AND owner_id = (SELECT auth.uid())::text
  AND (
    (SELECT public.current_user_is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('guide','agency')
    )
  )
);

-- Site imagery remains publicly readable, but only admins can mutate it.
DROP POLICY IF EXISTS site_images_admin_write ON storage.objects;
DROP POLICY IF EXISTS site_images_admin_insert ON storage.objects;
DROP POLICY IF EXISTS site_images_admin_update ON storage.objects;
DROP POLICY IF EXISTS site_images_admin_delete ON storage.objects;

CREATE POLICY site_images_admin_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-images'
  AND (SELECT public.current_user_is_admin())
);

CREATE POLICY site_images_admin_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'site-images'
  AND (SELECT public.current_user_is_admin())
)
WITH CHECK (
  bucket_id = 'site-images'
  AND (SELECT public.current_user_is_admin())
);

CREATE POLICY site_images_admin_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'site-images'
  AND (SELECT public.current_user_is_admin())
);

-- License documents are private. Consolidate duplicate owner/admin policies.
DROP POLICY IF EXISTS "Users and admins read license documents" ON storage.objects;
DROP POLICY IF EXISTS "Users upload their own licenses" ON storage.objects;
DROP POLICY IF EXISTS license_insert_own ON storage.objects;
DROP POLICY IF EXISTS license_select_admin ON storage.objects;
DROP POLICY IF EXISTS license_select_own ON storage.objects;
DROP POLICY IF EXISTS licenses_authenticated_select ON storage.objects;
DROP POLICY IF EXISTS licenses_authenticated_insert ON storage.objects;

CREATE POLICY licenses_authenticated_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'licenses'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR (SELECT public.current_user_is_admin())
  )
);

CREATE POLICY licenses_authenticated_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'licenses'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

NOTIFY pgrst, 'reload schema';