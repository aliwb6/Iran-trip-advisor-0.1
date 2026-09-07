-- Phase 3A profile write hardening.
-- Safe to apply before the final SELECT lockdown because legitimate profile
-- creation/update paths are owner-bound and do not need unrestricted writes.

DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.profiles;

REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- Keep a single explicit authenticated owner-insert contract. Existing duplicate
-- owner policies are harmless, but this policy documents the required invariant.
DROP POLICY IF EXISTS "Authenticated users insert own profile" ON public.profiles;
CREATE POLICY "Authenticated users insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = id);

NOTIFY pgrst, 'reload schema';