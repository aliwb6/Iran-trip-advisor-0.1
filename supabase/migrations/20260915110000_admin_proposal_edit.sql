-- Allow an administrator to correct a pending proposal before approving it.

CREATE OR REPLACE FUNCTION public.edit_pending_trip_proposal(
  proposal_id uuid,
  proposal_data jsonb
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.current_user_is_admin() THEN RAISE EXCEPTION 'Administrator access is required'; END IF;
  IF jsonb_typeof(proposal_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Proposal data must be an object'; END IF;

  UPDATE public.trip_slots
  SET price = NULLIF(proposal_data->>'price', '')::numeric,
      currency = NULLIF(proposal_data->>'currency', ''),
      price_type = NULLIF(proposal_data->>'price_type', ''),
      price_period = NULLIF(proposal_data->>'price_period', ''),
      itinerary = NULLIF(proposal_data->>'itinerary', ''),
      included = ARRAY(SELECT jsonb_array_elements_text(COALESCE(proposal_data->'included', '[]'::jsonb))),
      excluded = ARRAY(SELECT jsonb_array_elements_text(COALESCE(proposal_data->'excluded', '[]'::jsonb))),
      message = NULLIF(proposal_data->>'message', ''),
      images = ARRAY(SELECT jsonb_array_elements_text(COALESCE(proposal_data->'images', '[]'::jsonb))),
      transportation = ARRAY(SELECT jsonb_array_elements_text(COALESCE(proposal_data->'transportation', '[]'::jsonb)))
  WHERE id = proposal_id
    AND approval_status = 'pending_review';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_pending_trip_proposal(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_pending_trip_proposal(uuid, jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
