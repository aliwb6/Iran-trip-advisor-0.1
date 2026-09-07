-- Phase 1B: ensure the public view obeys caller RLS and remove direct access
-- to the admin helper from browser roles.

ALTER VIEW public.public_profiles SET (security_invoker = true);

DO $$
DECLARE
  policy_record record;
  fn record;
BEGIN
  -- Replace any legacy messages admin policy that relied on public.is_admin().
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND (qual ILIKE '%is_admin%' OR with_check ILIKE '%is_admin%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', policy_record.policyname);
  END LOOP;

  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_admin'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', fn.proname, fn.args);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS messages_admin_read_all ON public.messages;
CREATE POLICY messages_admin_read_all
  ON public.messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND (profiles.role = 'admin' OR profiles.is_admin IS TRUE)
  ));
