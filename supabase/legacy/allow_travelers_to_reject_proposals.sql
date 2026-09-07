DO $$
DECLARE
  owner_column TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trip_requests' AND column_name = 'user_id'
  ) THEN
    owner_column := 'user_id';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trip_requests' AND column_name = 'traveler_id'
  ) THEN
    owner_column := 'traveler_id';
  ELSE
    RAISE EXCEPTION 'trip_requests must have a user_id or traveler_id owner column';
  END IF;

  EXECUTE format($function$
    CREATE OR REPLACE FUNCTION public.reject_trip_proposal(proposal_id UUID)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $body$
    BEGIN
      IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.trip_slots AS slot
        JOIN public.trip_requests AS request ON request.id = slot.trip_request_id
        WHERE slot.id = proposal_id
          AND request.%I = (SELECT auth.uid())
          AND slot.status NOT IN ('rejected', 'finalized')
      ) THEN
        RAISE EXCEPTION 'Not authorized to reject this proposal';
      END IF;

      UPDATE public.trip_slots AS slot
      SET status = 'rejected'
      WHERE slot.id = proposal_id
        AND slot.status NOT IN ('rejected', 'finalized');
      RETURN FOUND;
    END;
    $body$;
  $function$, owner_column);
END $$;

REVOKE ALL ON FUNCTION public.reject_trip_proposal(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_trip_proposal(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_trip_proposal(UUID) TO authenticated;
