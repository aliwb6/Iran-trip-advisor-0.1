-- Providers may create tours as soon as their required profile fields are complete.
-- License approval remains a separate requirement for public profile visibility.

DROP POLICY IF EXISTS tours_authenticated_insert ON public.tours;

CREATE POLICY tours_authenticated_insert
ON public.tours
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_is_admin()
  OR (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS provider
      WHERE provider.id = (SELECT auth.uid())
        AND provider.role IN ('guide', 'agency')
        AND provider.profile_completed IS TRUE
    )
  )
);
