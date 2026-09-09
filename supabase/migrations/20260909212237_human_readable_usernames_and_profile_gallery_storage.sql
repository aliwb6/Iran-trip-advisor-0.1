CREATE OR REPLACE FUNCTION public.set_username_if_empty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  base text;
  candidate text;
  suffix text;
  attempt integer := 0;
BEGIN
  IF NEW.username IS NULL OR btrim(NEW.username) = '' THEN
    base := lower(trim(both '_' from regexp_replace(coalesce(NEW.full_name, ''), '[^[:alpha:]_]+', '_', 'g')));

    IF char_length(base) < 3 THEN
      base := lower(trim(both '_' from regexp_replace(split_part(coalesce(NEW.email, ''), '@', 1), '[^[:alpha:]_]+', '_', 'g')));
    END IF;

    IF char_length(base) < 3 THEN
      base := 'user';
    END IF;

    base := left(base, 24);
    candidate := base;

    WHILE EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE lower(p.username) = lower(candidate)
        AND p.id IS DISTINCT FROM NEW.id
    ) LOOP
      attempt := attempt + 1;
      suffix := regexp_replace(md5(NEW.id::text || ':' || attempt::text), '[0-9]', '', 'g');
      IF suffix = '' THEN suffix := 'user'; END IF;
      candidate := left(base, 24) || '_' || left(suffix, 6);
    END LOOP;

    NEW.username := candidate;
  ELSE
    candidate := lower(trim(both '_' from regexp_replace(btrim(NEW.username), '[^[:alpha:]_]+', '_', 'g')));
    IF char_length(candidate) < 3 THEN
      RAISE EXCEPTION 'Username must contain at least three letters'
        USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE lower(p.username) = lower(candidate)
        AND p.id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Username is already in use'
        USING ERRCODE = 'unique_violation';
    END IF;
    NEW.username := candidate;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_username ON public.profiles;
CREATE TRIGGER trg_set_username
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_username_if_empty();

UPDATE public.profiles
SET username = NULL
WHERE username IS NULL
   OR btrim(username) = ''
   OR username ~ '[0-9]';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
ON public.profiles (lower(username));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-gallery',
  'profile-gallery',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view profile gallery" ON storage.objects;
CREATE POLICY "Public can view profile gallery"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-gallery');

DROP POLICY IF EXISTS "Providers upload own profile gallery" ON storage.objects;
CREATE POLICY "Providers upload own profile gallery"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-gallery'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('guide', 'agency')
  )
);

DROP POLICY IF EXISTS "Providers delete own profile gallery" ON storage.objects;
CREATE POLICY "Providers delete own profile gallery"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-gallery'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('guide', 'agency')
  )
);
