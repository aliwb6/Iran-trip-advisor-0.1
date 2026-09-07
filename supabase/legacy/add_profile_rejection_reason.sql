ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS approval_reviewed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.approval_rejection_reason IS
  'Required reason recorded by an administrator when a guide or agency profile is rejected.';
