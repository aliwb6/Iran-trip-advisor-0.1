CREATE OR REPLACE FUNCTION public.cancel_trip_request(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_request public.trip_requests%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.user_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Only the traveler who created this request can cancel it';
  END IF;

  IF v_request.status IN ('completed','cancelled','expired','closed') THEN
    RAISE EXCEPTION 'This trip request can no longer be cancelled';
  END IF;

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  SELECT DISTINCT s.guide_id,
         'request_cancelled',
         'A trip request you proposed for was cancelled by the traveler.',
         request_id
  FROM public.trip_slots s
  WHERE s.trip_request_id = request_id
    AND s.proposal_round = v_request.proposal_round
    AND s.guide_id IS NOT NULL
    AND s.status IN ('accepted','chatting','selected','finalized');

  UPDATE public.trip_slots
  SET status = 'closed'
  WHERE trip_request_id = request_id
    AND proposal_round = v_request.proposal_round
    AND status IN ('accepted','chatting','selected','finalized');

  UPDATE public.trip_requests
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = request_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_trip_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_trip_request(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';