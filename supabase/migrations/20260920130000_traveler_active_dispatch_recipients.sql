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

-- The marketplace audience is a rolling two-provider queue, not a five-person
-- blast. Two providers receive the request initially. Each first Pending or
-- Reject decision unlocks precisely one more invitation, until max_proposals.
CREATE OR REPLACE FUNCTION public.dispatch_trip_request(p_request_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_active integer;
  v_audience_limit integer;
  v_capacity integer;
  v_batch integer;
  v_created integer := 0;
BEGIN
  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_request.status NOT IN ('active', 'pending', 'open')
     OR (v_request.expires_at IS NOT NULL AND v_request.expires_at <= now())
     OR (v_request.request_channel = 'direct_profile' AND v_request.direct_escalated_at IS NULL) THEN
    RETURN 0;
  END IF;

  UPDATE public.trip_request_dispatches
  SET status = 'expired', updated_at = now()
  WHERE trip_request_id = v_request.id
    AND proposal_round = v_request.proposal_round
    AND status = 'pending'
    AND expires_at <= now();

  SELECT LEAST(
    COALESCE(v_request.max_proposals, 5),
    2 + count(*)::integer
  )
  INTO v_audience_limit
  FROM public.trip_slots s
  WHERE s.trip_request_id = v_request.id
    AND s.proposal_round = v_request.proposal_round
    AND s.visibility_advanced_at IS NOT NULL;

  -- Submitted proposals remain part of the active audience; they are not
  -- replaced until the traveler advances the queue with Pending or Reject.
  SELECT count(*) INTO v_active
  FROM public.trip_request_dispatches
  WHERE trip_request_id = v_request.id
    AND proposal_round = v_request.proposal_round
    AND (status = 'responded' OR (status = 'pending' AND expires_at > now()));

  v_capacity := GREATEST(0, v_audience_limit - v_active);
  IF v_capacity = 0 THEN RETURN 0; END IF;

  SELECT COALESCE(max(batch_number), 0) + 1 INTO v_batch
  FROM public.trip_request_dispatches
  WHERE trip_request_id = v_request.id
    AND proposal_round = v_request.proposal_round;

  WITH candidates AS (
    SELECT p.id
    FROM public.profiles p
    WHERE private.marketplace_provider_is_eligible(p.id, v_request.destination)
      AND p.id <> v_request.user_id
      AND (v_request.direct_provider_id IS NULL OR p.id <> v_request.direct_provider_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.trip_request_dispatches d
        WHERE d.trip_request_id = v_request.id
          AND d.provider_id = p.id
          AND d.proposal_round = v_request.proposal_round
      )
    ORDER BY random()
    LIMIT v_capacity
  ), inserted AS (
    INSERT INTO public.trip_request_dispatches (
      trip_request_id, provider_id, proposal_round, batch_number, status, expires_at
    )
    SELECT v_request.id, c.id, v_request.proposal_round, v_batch, 'pending',
           now() + private.trip_request_dispatch_timeout()
    FROM candidates c
    ON CONFLICT (trip_request_id, provider_id, proposal_round) DO NOTHING
    RETURNING provider_id
  ), notified AS (
    INSERT INTO public.notifications (user_id, type, message, related_request_id)
    SELECT i.provider_id, 'tour_request',
           'You have a new trip request matching your services.', v_request.id
    FROM inserted i
    RETURNING user_id
  )
  SELECT count(*) INTO v_created FROM notified;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_trip_request(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- The lifecycle functions already set this marker only on the first Pending or
-- Reject decision. A trigger keeps dispatch advancement centralized and makes
-- the transition atomic with the traveler decision.
CREATE OR REPLACE FUNCTION public.advance_trip_request_dispatch_audience()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.visibility_advanced_at IS NULL AND NEW.visibility_advanced_at IS NOT NULL THEN
    PERFORM public.dispatch_trip_request(NEW.trip_request_id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_trip_request_dispatch_audience()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_advance_trip_request_dispatch_audience ON public.trip_slots;
CREATE TRIGGER trg_advance_trip_request_dispatch_audience
AFTER UPDATE OF visibility_advanced_at ON public.trip_slots
FOR EACH ROW
WHEN (OLD.visibility_advanced_at IS NULL AND NEW.visibility_advanced_at IS NOT NULL)
EXECUTE FUNCTION public.advance_trip_request_dispatch_audience();
