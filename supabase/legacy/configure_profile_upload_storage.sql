-- Secure storage buckets for profile photos and private license documents.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('licenses', 'licenses', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS license_status_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_license_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_license_status_check
  CHECK (license_status IN ('not_uploaded', 'pending_review', 'verified', 'rejected'));

DROP POLICY IF EXISTS "Users upload their own avatars" ON storage.objects;
CREATE POLICY "Users upload their own avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users read their own avatar objects" ON storage.objects;
CREATE POLICY "Users read their own avatar objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND owner_id = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users upload their own licenses" ON storage.objects;
CREATE POLICY "Users upload their own licenses"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'licenses'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "Users and admins read license documents" ON storage.objects;
CREATE POLICY "Users and admins read license documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'licenses'
    AND (
      owner_id = (SELECT auth.uid()::text)
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND (profiles.role = 'admin' OR profiles.is_admin = true)
      )
    )
  );
