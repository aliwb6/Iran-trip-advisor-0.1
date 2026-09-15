-- Allow the traveler to pay the 15% deposit as soon as a proposal is selected.
-- The provider still confirms the booking afterwards; that confirmation only
-- advances the trip request from confirmed to booked.

CREATE OR REPLACE FUNCTION private.create_selected_trip_booking(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_slot public.trip_slots%ROWTYPE;
  v_booking_id uuid;
  v_people integer;
  v_days integer;
  v_total numeric;
  v_commission_rate numeric;
  v_deposit_percentage numeric;
  v_tourist_name text;
BEGIN
  SELECT b.id INTO v_booking_id
  FROM public.bookings b
  WHERE b.request_id = p_request_id
  FOR UPDATE;

  IF v_booking_id IS NOT NULL THEN
    RETURN v_booking_id;
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.selected_guide_id IS NULL THEN
    RAISE EXCEPTION 'A selected guide is required before creating a booking';
  END IF;

  SELECT * INTO v_slot
  FROM public.trip_slots s
  WHERE s.trip_request_id = p_request_id
    AND s.guide_id = v_request.selected_guide_id
    AND s.proposal_round = v_request.proposal_round
    AND s.status = 'selected'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No selected proposal was found for this booking';
  END IF;

  IF v_slot.price IS NULL OR v_slot.price <= 0
     OR v_slot.price_type NOT IN ('per_person', 'entire_group')
     OR v_slot.price_period NOT IN ('per_day', 'entire_trip') THEN
    RAISE EXCEPTION 'Selected proposal does not have valid pricing';
  END IF;

  v_people := GREATEST(
    1,
    COALESCE(
      NULLIF(COALESCE(v_request.adults, 0) + COALESCE(v_request.children, 0), 0),
      NULLIF(v_request.num_people, 0),
      1
    )
  );
  v_days := GREATEST(
    1,
    COALESCE(
      CASE WHEN v_request.start_date IS NOT NULL AND v_request.end_date IS NOT NULL
        THEN NULLIF(v_request.end_date - v_request.start_date, 0)
      END,
      NULLIF(v_request.duration, 0),
      1
    )
  );
  v_total := round(
    v_slot.price
      * CASE WHEN v_slot.price_type = 'per_person' THEN v_people ELSE 1 END
      * CASE WHEN v_slot.price_period = 'per_day' THEN v_days ELSE 1 END,
    2
  );

  SELECT p.commission_rate INTO v_commission_rate
  FROM public.profiles p
  WHERE p.id = v_request.selected_guide_id;
  v_commission_rate := CASE
    WHEN v_commission_rate BETWEEN 0 AND 1 THEN v_commission_rate
    ELSE 0.15
  END;

  SELECT CASE WHEN jsonb_typeof(s.value) = 'number' THEN (s.value::text)::numeric END
  INTO v_deposit_percentage
  FROM public.site_settings s
  WHERE s.key = 'booking_deposit_percentage';
  v_deposit_percentage := CASE
    WHEN v_deposit_percentage BETWEEN 0 AND 1 THEN v_deposit_percentage
    ELSE 0.15
  END;

  SELECT p.full_name INTO v_tourist_name
  FROM public.profiles p
  WHERE p.id = v_request.user_id;

  INSERT INTO public.bookings (
    guide_id, tourist_id, tour_id, tourist_name, tourist_email, tour_title,
    start_date, end_date, num_people, price, currency, status, notes, request_id,
    commission_amount, guide_payout, deposit_amount, balance_due, contact_released,
    slot_id, quoted_unit_price, price_type, price_period, traveler_count,
    trip_duration_days, commission_rate, deposit_percentage, payment_status, booked_at
  ) VALUES (
    v_request.selected_guide_id, v_request.user_id, NULL, v_tourist_name, NULL,
    COALESCE(v_request.title, array_to_string(v_request.destination, ', '), 'Custom trip'),
    v_request.start_date, v_request.end_date, v_people, v_total,
    COALESCE(NULLIF(v_slot.currency, ''), NULLIF(v_request.currency, ''), 'USD'),
    'confirmed', NULL, p_request_id,
    round(v_total * v_commission_rate, 2),
    v_total - round(v_total * v_commission_rate, 2),
    round(v_total * v_deposit_percentage, 2),
    v_total - round(v_total * v_deposit_percentage, 2),
    false, v_slot.id, v_slot.price, v_slot.price_type, v_slot.price_period,
    v_people, v_days, v_commission_rate, v_deposit_percentage, 'unpaid', now()
  ) RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION private.create_selected_trip_booking(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.select_trip_guide(request_id uuid, selected_guide_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id uuid := request_id;
  v_selected_guide_id uuid := selected_guide_id;
  v_request public.trip_requests%ROWTYPE;
  v_winner_slot uuid;
  v_loser record;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request FROM public.trip_requests
  WHERE id = v_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.user_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to select a guide for this request';
  END IF;
  IF v_request.status IN ('confirmed', 'closed', 'booked', 'completed', 'expired', 'cancelled') THEN
    RAISE EXCEPTION 'This trip request can no longer change its selected guide';
  END IF;

  SELECT s.id INTO v_winner_slot FROM public.trip_slots s
  WHERE s.trip_request_id = v_request_id
    AND s.guide_id = v_selected_guide_id
    AND s.proposal_round = v_request.proposal_round
    AND s.status NOT IN ('rejected', 'finalized', 'closed')
  FOR UPDATE;
  IF v_winner_slot IS NULL THEN
    RAISE EXCEPTION 'Selected guide does not have an active proposal for this request';
  END IF;

  FOR v_loser IN
    SELECT s.id, s.guide_id FROM public.trip_slots s
    WHERE s.trip_request_id = v_request_id
      AND s.proposal_round = v_request.proposal_round
      AND s.guide_id <> v_selected_guide_id
      AND s.status NOT IN ('rejected', 'finalized', 'closed')
    FOR UPDATE
  LOOP
    UPDATE public.trip_slots SET status = 'rejected' WHERE id = v_loser.id;
    INSERT INTO public.notifications (user_id, type, message, related_request_id)
    VALUES (v_loser.guide_id, 'request_filled',
      'A trip request you proposed for has been filled by another guide or agency.', v_request_id);
  END LOOP;

  UPDATE public.trip_slots SET status = 'selected' WHERE id = v_winner_slot;
  UPDATE public.trip_requests
  SET status = 'confirmed', selected_guide_id = v_selected_guide_id, proposals_count = 1, updated_at = now()
  WHERE id = v_request_id;

  PERFORM private.create_selected_trip_booking(v_request_id);

  -- Keep the existing provider notification/email trigger path intact.
  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (v_selected_guide_id, 'guide_selected',
    'Congratulations! A traveler selected you for their trip request.', v_request_id);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_selected_trip_slot(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_slot_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request FROM public.trip_requests WHERE id = request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip request not found'; END IF;
  IF v_request.selected_guide_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Only the selected guide or agency can confirm this booking';
  END IF;
  IF v_request.status = 'booked' THEN RETURN true; END IF;
  IF v_request.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed trip requests can be booked';
  END IF;

  SELECT s.id INTO v_slot_id FROM public.trip_slots s
  WHERE s.trip_request_id = request_id AND s.guide_id = (SELECT auth.uid())
    AND s.proposal_round = v_request.proposal_round AND s.status = 'selected'
  FOR UPDATE;
  IF v_slot_id IS NULL THEN RAISE EXCEPTION 'No selected proposal was found for this booking'; END IF;

  PERFORM private.create_selected_trip_booking(request_id);
  UPDATE public.trip_slots SET status = 'finalized', finalized_at = COALESCE(finalized_at, now()) WHERE id = v_slot_id;
  UPDATE public.trip_requests SET status = 'booked', updated_at = now() WHERE id = request_id;
  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (v_request.user_id, 'trip_booked',
    'Your selected guide or agency confirmed the trip. Your booking is confirmed.', request_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.select_trip_guide(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_trip_guide(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finalize_selected_trip_slot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_selected_trip_slot(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
