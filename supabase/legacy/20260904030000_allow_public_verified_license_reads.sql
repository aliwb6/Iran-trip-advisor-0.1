-- Tourists may view only a license whose owner is approved and whose license
-- has been verified. The bucket remains private and clients receive a short-
-- lived signed URL instead of a permanent public object URL.
DROP POLICY IF EXISTS "Public reads approved verified licenses" ON storage.objects;
CREATE POLICY "Public reads approved verified licenses"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'licenses'
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.is_approved = true
        AND profiles.license_status = 'verified'
        AND profiles.license_url = storage.objects.name
    )
  );
