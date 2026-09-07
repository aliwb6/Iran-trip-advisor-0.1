ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS age SMALLINT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_age_valid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_age_valid
  CHECK (age IS NULL OR age BETWEEN 1 AND 120);

COMMENT ON COLUMN public.profiles.nationality IS
  'Traveler-provided nationality or cultural origin.';

COMMENT ON COLUMN public.profiles.age IS
  'Traveler-provided age, limited to a plausible range.';
