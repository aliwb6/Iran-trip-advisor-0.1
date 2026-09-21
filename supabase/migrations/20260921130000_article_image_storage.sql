-- Public cover images for articles written by guides, agencies, and admins.
-- Objects are grouped by uploader id so providers can only manage their own files.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'article-images',
  'article-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS article_images_public_read ON storage.objects;
CREATE POLICY article_images_public_read
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'article-images');

DROP POLICY IF EXISTS article_images_provider_upload ON storage.objects;
CREATE POLICY article_images_provider_upload
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'article-images'
  AND owner_id = (SELECT auth.uid())::text
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND (
    (SELECT public.current_user_is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.profiles profile
      WHERE profile.id = (SELECT auth.uid())
        AND profile.role IN ('guide', 'agency')
    )
  )
);

DROP POLICY IF EXISTS article_images_provider_delete ON storage.objects;
CREATE POLICY article_images_provider_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'article-images'
  AND owner_id = (SELECT auth.uid())::text
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
