-- Correct the admin helper privilege needed by profiles RLS policies.
-- The helper is SECURITY DEFINER and returns only a boolean. Authenticated users
-- must be able to execute it because the explicit admin SELECT/UPDATE policies
-- reference it during normal profile table access. Anonymous users remain denied.

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

NOTIFY pgrst, 'reload schema';