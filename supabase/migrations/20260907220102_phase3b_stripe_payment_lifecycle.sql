-- Phase 3B: Stripe-hosted Checkout payment lifecycle.
-- Browser clients remain read-only for bookings/payments. Server functions using
-- the Supabase service role create/attach payment attempts and process verified
-- provider webhook events. No Stripe secret is stored in Postgres.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN (
    'unpaid',
    'deposit_pending',
    'payment_pending',
    'deposit_paid',
    'paid',
    'refunded',
    'failed'
  ));

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider_session_id text,
  ADD COLUMN IF NOT EXISTS provider_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS provider_amount_minor bigint,
  ADD COLUMN IF NOT EXISTS provider_currency text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_session_unique
  ON public.payments (provider, provider_session_id)
  WHERE provider IS NOT NULL AND provider_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_active_attempt_per_type
  ON public.payments (booking_id, payment_type, provider)
  WHERE status IN ('pending','processing');

CREATE TABLE IF NOT EXISTS public.payment_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT,
  provider_session_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT payment_provider_events_provider_event_unique UNIQUE (provider, event_id)
);

ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_provider_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payment_provider_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_payment_provider_events_payment_id
  ON public.payment_provider_events (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_provider_events_received_at
  ON public.payment_provider_events (received_at DESC);

-- Create or reuse one active provider attempt for a booking/payment type.
-- All monetary values are copied from the immutable booking snapshot.
CREATE OR REPLACE FUNCTION public.create_booking_payment_attempt(
  p_booking_id uuid,
  p_tourist_id uuid,
  p_provider text,
  p_payment_type text DEFAULT 'deposit'
)
RETURNS TABLE (
  payment_id uuid,
  booking_id uuid,
  amount numeric,
  currency text,
  payment_type text,
  provider_session_id text,
  is_existing boolean,
  booking_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_existing public.payments%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_amount numeric;
  v_commission numeric;
  v_provider_net numeric;
BEGIN
  IF p_provider IS NULL OR btrim(p_provider) = '' THEN
    RAISE EXCEPTION 'Payment provider is required';
  END IF;

  IF p_payment_type NOT IN ('deposit','balance','full') THEN
    RAISE EXCEPTION 'Unsupported payment type';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.tourist_id <> p_tourist_id THEN
    RAISE EXCEPTION 'Only the booking traveler may initiate payment';
  END IF;

  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'This booking is not payable';
  END IF;

  IF p_payment_type = 'deposit' THEN
    IF v_booking.payment_status IN ('deposit_paid','paid','refunded') THEN
      RAISE EXCEPTION 'Deposit has already been settled';
    END IF;
    v_amount := v_booking.deposit_amount;
  ELSIF p_payment_type = 'balance' THEN
    IF v_booking.payment_status <> 'deposit_paid' THEN
      RAISE EXCEPTION 'Balance payment requires a settled deposit';
    END IF;
    v_amount := v_booking.balance_due;
  ELSE
    IF v_booking.payment_status IN ('deposit_paid','paid','refunded') THEN
      RAISE EXCEPTION 'Full payment is not available for this booking state';
    END IF;
    v_amount := v_booking.price;
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT * INTO v_existing
  FROM public.payments p
  WHERE p.booking_id = p_booking_id
    AND p.payment_type = p_payment_type
    AND p.provider = p_provider
    AND p.status IN ('pending','processing')
  ORDER BY p.created_at DESC NULLS LAST, p.id
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_existing.id,
      v_existing.booking_id,
      v_existing.total_amount,
      COALESCE(v_existing.currency, v_booking.currency),
      v_existing.payment_type,
      v_existing.provider_session_id,
      true,
      v_booking.tour_title;
    RETURN;
  END IF;

  v_commission := round(v_amount * v_booking.commission_rate, 2);
  v_provider_net := v_amount - v_commission;

  INSERT INTO public.payments (
    booking_id,
    tourist_id,
    guide_id,
    total_amount,
    currency,
    commission_rate,
    commission_amount,
    guide_payout,
    deposit_percentage,
    deposit_amount,
    balance_due,
    status,
    payment_type,
    provider,
    metadata,
    updated_at
  ) VALUES (
    v_booking.id,
    v_booking.tourist_id,
    v_booking.guide_id,
    v_amount,
    v_booking.currency,
    v_booking.commission_rate,
    v_commission,
    v_provider_net,
    v_booking.deposit_percentage,
    v_booking.deposit_amount,
    v_booking.balance_due,
    'pending',
    p_payment_type,
    p_provider,
    jsonb_build_object(
      'booking_total', v_booking.price,
      'quoted_unit_price', v_booking.quoted_unit_price,
      'booking_payment_status_before', v_booking.payment_status
    ),
    now()
  )
  RETURNING * INTO v_payment;

  UPDATE public.bookings
  SET payment_status = CASE
        WHEN p_payment_type = 'deposit' THEN 'deposit_pending'
        ELSE 'payment_pending'
      END,
      updated_at = now()
  WHERE id = v_booking.id;

  RETURN QUERY SELECT
    v_payment.id,
    v_payment.booking_id,
    v_payment.total_amount,
    COALESCE(v_payment.currency, v_booking.currency),
    v_payment.payment_type,
    v_payment.provider_session_id,
    false,
    v_booking.tour_title;
END;
$$;

-- Attach the Stripe Checkout Session only after Stripe successfully creates it.
CREATE OR REPLACE FUNCTION public.attach_payment_provider_session(
  p_payment_id uuid,
  p_provider_session_id text,
  p_provider_amount_minor bigint,
  p_provider_currency text,
  p_provider_payment_intent_id text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  IF p_provider_session_id IS NULL OR btrim(p_provider_session_id) = '' THEN
    RAISE EXCEPTION 'Provider session id is required';
  END IF;

  IF p_provider_amount_minor IS NULL OR p_provider_amount_minor <= 0 THEN
    RAISE EXCEPTION 'Provider amount must be positive';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments p
  WHERE p.id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment attempt not found';
  END IF;

  IF v_payment.status NOT IN ('pending','processing') THEN
    RAISE EXCEPTION 'Payment attempt is not attachable';
  END IF;

  UPDATE public.payments
  SET provider_session_id = p_provider_session_id,
      payment_reference = p_provider_session_id,
      provider_amount_minor = p_provider_amount_minor,
      provider_currency = lower(p_provider_currency),
      provider_payment_intent_id = COALESCE(p_provider_payment_intent_id, provider_payment_intent_id),
      expires_at = p_expires_at,
      updated_at = now()
  WHERE id = p_payment_id;

  RETURN true;
END;
$$;

-- Fail a local attempt when provider session creation fails or a server-side
-- preflight determines the attempt can no longer be used.
CREATE OR REPLACE FUNCTION public.fail_booking_payment_attempt(
  p_payment_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments p
  WHERE p.id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_payment.status IN ('paid','refunded','failed') THEN
    RETURN true;
  END IF;

  UPDATE public.payments
  SET status = 'failed',
      failure_reason = left(COALESCE(p_reason, 'Payment attempt failed'), 500),
      processed_at = now(),
      updated_at = now()
  WHERE id = p_payment_id;

  UPDATE public.bookings b
  SET payment_status = CASE
        WHEN v_payment.payment_type = 'balance' AND b.contact_released IS TRUE THEN 'deposit_paid'
        ELSE 'failed'
      END,
      updated_at = now()
  WHERE b.id = v_payment.booking_id
    AND b.payment_status IN ('deposit_pending','payment_pending');

  RETURN true;
END;
$$;

-- Consume one already-verified provider event exactly once. The Vercel webhook
-- validates Stripe's signature before invoking this service-role-only function.
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

  -- Successful synchronous or asynchronous Checkout payment.
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

  -- Checkout completed with an asynchronous method still waiting on settlement.
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

REVOKE ALL ON FUNCTION public.create_booking_payment_attempt(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_payment_provider_session(uuid,text,bigint,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_booking_payment_attempt(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_payment_provider_event(text,text,text,uuid,text,text,bigint,text,text,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_booking_payment_attempt(uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_payment_provider_session(uuid,text,bigint,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_booking_payment_attempt(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_payment_provider_event(text,text,text,uuid,text,text,bigint,text,text,timestamptz,jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';