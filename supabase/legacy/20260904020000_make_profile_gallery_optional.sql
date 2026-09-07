CREATE OR REPLACE FUNCTION public.check_profile_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IN ('guide', 'agency') THEN
    NEW.profile_completed := (
      NULLIF(btrim(NEW.full_name), '') IS NOT NULL
      AND NULLIF(btrim(NEW.phone), '') IS NOT NULL
      AND NULLIF(btrim(NEW.city), '') IS NOT NULL
      AND length(COALESCE(NEW.bio, '')) >= 50
      AND NULLIF(btrim(NEW.avatar_url), '') IS NOT NULL
      AND NULLIF(btrim(NEW.languages), '') IS NOT NULL
      AND (
        (NEW.role = 'agency' AND (
          COALESCE(cardinality(NEW.tour_types), 0) > 0
          OR COALESCE(cardinality(NEW.specialties), 0) > 0
          OR NULLIF(btrim(NEW.specialty), '') IS NOT NULL
        ))
        OR
        (NEW.role = 'guide' AND (
          COALESCE(cardinality(NEW.specialties), 0) > 0
          OR COALESCE(cardinality(NEW.tour_types), 0) > 0
          OR NULLIF(btrim(NEW.specialty), '') IS NOT NULL
        ))
      )
      AND NULLIF(btrim(NEW.license_url), '') IS NOT NULL
      AND NEW.license_status = 'verified'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Re-run the completion trigger for existing guide and agency profiles.
UPDATE public.profiles
SET profile_completed = profile_completed
WHERE role IN ('guide', 'agency');
