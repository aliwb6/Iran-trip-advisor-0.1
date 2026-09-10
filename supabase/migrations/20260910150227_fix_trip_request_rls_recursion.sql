-- Break the recursive RLS dependency between trip_requests and trip_slots.
--
-- Previously:
--   trip_requests SELECT policy -> EXISTS trip_slots
--   trip_slots SELECT policy    -> EXISTS trip_requests
-- which causes PostgreSQL error 42P17: infinite recursion detected in policy.
--
-- These private SECURITY DEFINER predicates perform only the minimal boolean
-- relationship checks and bypass nested table RLS. They are not exposed to anon.

CREATE OR REPLACE FUNCTION private.current_user_has_trip_slot(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_slots s
    WHERE s.trip_request_id = p_request_id
      AND s.guide_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION private.current_user_has_trip_slot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_has_trip_slot(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.current_user_owns_trip_request(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_requests r
    WHERE r.id = p_request_id
      AND r.user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION private.current_user_owns_trip_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_owns_trip_request(uuid) TO authenticated;

DROP POLICY IF EXISTS trip_requests_authenticated_select ON public.trip_requests;
CREATE POLICY trip_requests_authenticated_select
ON public.trip_requests
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR selected_guide_id = (SELECT auth.uid())
  OR private.current_user_is_admin()
  OR (
    request_channel = 'direct_profile'
    AND direct_escalated_at IS NULL
    AND direct_provider_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.trip_request_dispatches d
    WHERE d.trip_request_id = trip_requests.id
      AND d.provider_id = (SELECT auth.uid())
      AND d.proposal_round = trip_requests.proposal_round
      AND d.status IN ('pending', 'responded', 'declined', 'expired', 'closed')
  )
  OR private.current_user_has_trip_slot(id)
);

DROP POLICY IF EXISTS trip_slots_authenticated_select ON public.trip_slots;
CREATE POLICY trip_slots_authenticated_select
ON public.trip_slots
FOR SELECT
TO authenticated
USING (
  guide_id = (SELECT auth.uid())
  OR private.current_user_owns_trip_request(trip_request_id)
);

NOTIFY pgrst, 'reload schema';
