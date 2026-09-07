-- Phase 3B: prevent trip cancellation from racing or bypassing an active/settled payment.
-- Refund handling is intentionally not implemented yet; paid bookings must enter
-- a future refund/cancellation workflow rather than being cancelled directly.

CREATE OR REPLACE FUNCTION public.cancel_trip_request(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
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

  -- If a canonical booking exists, lock it as part of the same transaction so
  -- cancellation cannot race payment initiation or webhook settlement.
  SELECT * INTO v_booking
  FROM public.bookings b
  WHERE b.request_id = request_id
  FOR UPDATE;

  IF FOUND AND v_booking.payment_status IN (
    'deposit_pending',
    'payment_pending',
    'deposit_paid',
    'paid',
    'refunded'
  ) THEN
    RAISE EXCEPTION 'This booking has an active or settled payment and cannot be cancelled directly';
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

-- Do not settle a provider event into a booking that is no longer payable.
CREATE OR REPLACE FUNCTION public.process_payment_provider_event(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_payment_id uuid,
  p_provider_session_id text,
  p_provider_payment_intent_id text DEFAULT NULL,
  p_provider_amount_minor bigint DEFAULT NULL,
  p_provider_currency text DEFAULT NULL,
  p_provider_payment_status text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_row_id uuid;
  v_payment public.payments%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_new_booking_status text;
  v_failure_reason text;
BEGIN
  INSERT INTO public.payment_provider_events (
    provider,
    event_id,
    event_type,
    payment_id,
    provider_session_id,
    metadata
  ) VALUES (
    p_provider,
    p_event_id,
    p_event_type,
    p_payment_id,
    p_provider_session_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (provider, event_id) DO NOTHING
  RETURNING id INTO v_event_row_id;

  IF v_event_row_id IS NULL THEN
    RETURN 'duplicate';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments p
  WHERE p.id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.payment_provider_events
    SET processing_error = 'Payment not found', processed_at = now()
    WHERE id = v_event_row_id;
    RETURN 'payment_not_found';
  END IF;

  IF v_payment.provider IS DISTINCT FROM p_provider THEN
    UPDATE public.payment_provider_events
    SET processing_error = 'Provider mismatch', processed_at = now()
    WHERE id = v_event_row_id;
    RETURN 'provider_mismatch';
  END IF;

  IF v_payment.provider_session_id IS NOT NULL
     AND v_payment.provider_session_id IS DISTINCT FROM p_provider_session_id THEN
    UPDATE public.payment_provider_events
    SET processing_error = 'Provider session mismatch', processed_at = now()
    WHERE id = v_event_row_id;
    RETURN 'session_mismatch';
  END IF;

  IF p_provider_amount_minor IS NOT NULL
     AND v_payment.provider_amount_minor IS NOT NULL
     AND p_provider_amount_minor <> v_payment.provider_amount_minor THEN
    UPDATE public.payment_provider_events
    SET processing_error = 'Amount mismatch', processed_at = now()
    WHERE id = v_event_row_id;
    RETURN 'amount_mismatch';
  END IF;

  IF p_provider_currency IS NOT NULL
     AND v_payment.provider_currency IS NOT NULL
     AND lower(p_provider_currency) <> lower(v_payment.provider_currency) THEN
    UPDATE public.payment_provider_events
    SET processing_error = 'Currency mismatch', processed_at = now()
    WHERE id = v_event_row_id;
    RETURN 'currency_mismatch';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings b
  WHERE b.id = v_payment.booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.payment_provider_events
    SET processing_error = 'Booking not found', processed_at = now()
    WHERE id = v_event_row_id;
    RETURN 'booking_not_found';
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    UPDATE public.payment_provider_events
    SET processing_error = 'Booking is not payable', processed_at = now()
    WHERE id = v_event_row_id;
    RETURN 'booking_not_payable';
  END IF;

  IF p_event_type IN ('checkout.session.completed','checkout.session.async_payment_succeeded')
     AND p_provider_payment_status = 'paid' THEN

    IF v_payment.status <> 'paid' THEN
      UPDATE public.payments
      SET status = 'paid',
          provider_event_id = COALESCE(provider_event_id, p_event_id),
          provider_session_id = COALESCE(provider_session_id, p_provider_session_id),
          payment_reference = COALESCE(payment_reference, p_provider_session_id),
          provider_payment_intent_id = COALESCE(p_provider_payment_intent_id, provider_payment_intent_id),
          payment_method = COALESCE(payment_method, p_provider || '_checkout'),
          paid_at = COALESCE(p_paid_at, now()),
          processed_at = now(),
          failure_reason = NULL,
          updated_at = now()
      WHERE id = v_payment.id;

      v_new_booking_status := CASE
        WHEN v_payment.payment_type = 'deposit'
             AND abs(v_booking.deposit_amount - v_booking.price) >= 0.01
          THEN 'deposit_paid'
        ELSE 'paid'
      END;

      UPDATE public.bookings
      SET payment_status = v_new_booking_status,
          contact_released = true,
          updated_at = now()
      WHERE id = v_booking.id;

      INSERT INTO public.notifications (user_id, type, message, related_request_id)
      VALUES (
        v_booking.tourist_id,
        CASE WHEN v_new_booking_status = 'deposit_paid' THEN 'deposit_paid' ELSE 'payment_paid' END,
        CASE
          WHEN v_new_booking_status = 'deposit_paid'
            THEN 'Your booking deposit was received. Contact details are now available.'
          ELSE 'Your booking payment was received. Contact details are now available.'
        END,
        v_booking.request_id
      );

      INSERT INTO public.notifications (user_id, type, message, related_request_id)
      VALUES (
        v_booking.guide_id,
        'contact_released',
        'The traveler payment was confirmed. Booking contact details are now available.',
        v_booking.request_id
      );
    END IF;

    UPDATE public.payment_provider_events
    SET processed_at = now()
    WHERE id = v_event_row_id;
    RETURN 'paid';
  END IF;

  IF p_event_type = 'checkout.session.completed'
     AND COALESCE(p_provider_payment_status, '') <> 'paid' THEN
    UPDATE public.payments
    SET status = 'processing',
        provider_event_id = COALESCE(provider_event_id, p_event_id),
        provider_payment_intent_id = COALESCE(p_provider_payment_intent_id, provider_payment_intent_id),
        updated_at = now()
    WHERE id = v_payment.id
      AND status = 'pending';

    UPDATE public.payment_provider_events
    SET processed_at = now()
    WHERE id = v_event_row_id;
    RETURN 'processing';
  END IF;

  IF p_event_type IN ('checkout.session.expired','checkout.session.async_payment_failed') THEN
    v_failure_reason := CASE
      WHEN p_event_type = 'checkout.session.expired' THEN 'Checkout session expired'
      ELSE 'Asynchronous payment failed'
    END;

    IF v_payment.status IN ('pending','processing') THEN
      UPDATE public.payments
      SET status = 'failed',
          provider_event_id = COALESCE(provider_event_id, p_event_id),
          failure_reason = v_failure_reason,
          processed_at = now(),
          updated_at = now()
      WHERE id = v_payment.id;

      UPDATE public.bookings
      SET payment_status = CASE
            WHEN v_payment.payment_type = 'balance' AND contact_released IS TRUE THEN 'deposit_paid'
            ELSE 'failed'
          END,
          updated_at = now()
      WHERE id = v_booking.id
        AND payment_status IN ('deposit_pending','payment_pending');
    END IF;

    UPDATE public.payment_provider_events
    SET processed_at = now()
    WHERE id = v_event_row_id;
    RETURN 'failed';
  END IF;

  UPDATE public.payment_provider_events
  SET processed_at = now()
  WHERE id = v_event_row_id;
  RETURN 'ignored';
END;
$$;

REVOKE ALL ON FUNCTION public.process_payment_provider_event(text,text,text,uuid,text,text,bigint,text,text,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_provider_event(text,text,text,uuid,text,text,bigint,text,text,timestamptz,jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';