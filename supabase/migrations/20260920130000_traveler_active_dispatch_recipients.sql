-- Let a traveler see only the public profile cards for providers who currently
-- hold a live invitation to their own request. The private dispatch ledger
-- itself remains inaccessible to travelers and the list naturally shrinks
-- when a provider submits a proposal (pending -> responded).

CREATE OR REPLACE FUNCTION public.get_my_active_trip_request_dispatches(
  p_request_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  trip_request_id uuid,
  provider_id uuid,
  full_name text,
  avatar_url text,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    d.trip_request_id,
    d.provider_id,
    p.full_name,
    p.avatar_url,
    p.role
  FROM public.trip_request_dispatches d
  JOIN public.trip_requests r ON r.id = d.trip_request_id
  JOIN public.profiles p ON p.id = d.provider_id
  WHERE r.user_id = (SELECT auth.uid())
    AND d.proposal_round = r.proposal_round
    AND d.status = 'pending'
    AND d.expires_at > now()
    AND (p_request_ids IS NULL OR d.trip_request_id = ANY(p_request_ids))
  ORDER BY d.invited_at ASC, d.provider_id ASC;
$$;

REVOKE ALL ON FUNCTION public.get_my_active_trip_request_dispatches(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_active_trip_request_dispatches(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
