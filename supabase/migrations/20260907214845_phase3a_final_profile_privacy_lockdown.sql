-- Phase 3A final profile privacy lockdown.
-- Public/provider discovery and authenticated counterpart lookups now use
-- dedicated SECURITY DEFINER RPCs. Direct profile table reads are limited to
-- the authenticated user's own row or administrators through explicit RLS.

DROP POLICY IF EXISTS "Public profiles viewable by all" ON public.profiles;
DROP POLICY IF EXISTS "select_profiles" ON public.profiles;

-- Keep the privilege surface explicit: anonymous clients cannot read the raw
-- profiles table; authenticated clients retain SELECT so owner/admin RLS can
-- authorize only the rows they are allowed to access.
REVOKE SELECT ON TABLE public.profiles FROM anon;
GRANT SELECT ON TABLE public.profiles TO authenticated;

NOTIFY pgrst, 'reload schema';