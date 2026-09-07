-- Phase 3A: canonical booking + finance foundation.
-- No real payment provider is connected in this migration.

-- 1) Platform-level booking deposit default. Individual bookings snapshot this value.
INSERT INTO public.site_settings (key, value, updated_at)
VALUES ('booking_deposit_percentage', '0.20'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- 2) Canonicalize bookings as the immutable commercial snapshot created when
--    the selected provider finalizes a confirmed trip request.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS quoted_unit_price numeric,
  ADD COLUMN IF NOT EXISTS price_type text,
  ADD COLUMN IF NOT EXISTS price_period text,
  ADD COLUMN IF NOT EXISTS traveler_count integer,
  ADD COLUMN IF NOT EXISTS trip_duration_days integer,
  ADD COLUMN IF NOT EXISTS commission_rate numeric,
  ADD COLUMN IF NOT EXISTS deposit_percentage numeric,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS booked_at timestamptz;

ALTER TABLE public.bookings
  ALTER COLUMN tourist_id SET NOT NULL,
  ALTER COLUMN request_id SET NOT NULL,
  ALTER COLUMN slot_id SET NOT NULL,
  ALTER COLUMN price SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'confirmed',
  ALTER COLUMN commission_amount SET NOT NULL,
  ALTER COLUMN guide_payout SET NOT NULL,
  ALTER COLUMN deposit_amount SET NOT NULL,
  ALTER COLUMN balance_due SET NOT NULL,
  ALTER COLUMN contact_released SET NOT NULL,
  ALTER COLUMN contact_released SET DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_request_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_request_id_fkey
      FOREIGN KEY (request_id) REFERENCES public.trip_requests(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_request_id_key'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_request_id_key UNIQUE (request_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_slot_id_key'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_slot_id_key UNIQUE (slot_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_price_positive_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_price_positive_check CHECK (price > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_quoted_unit_price_positive_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_quoted_unit_price_positive_check
      CHECK (quoted_unit_price IS NOT NULL AND quoted_unit_price > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_price_type_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_price_type_check
      CHECK (price_type IN ('per_person','entire_group'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_price_period_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_price_period_check
      CHECK (price_period IN ('per_day','entire_trip'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_traveler_count_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_traveler_count_check CHECK (traveler_count >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_trip_duration_days_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_trip_duration_days_check CHECK (trip_duration_days >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_commission_rate_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_commission_rate_check CHECK (commission_rate >= 0 AND commission_rate <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_deposit_percentage_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_deposit_percentage_check CHECK (deposit_percentage >= 0 AND deposit_percentage <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_financial_amounts_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_financial_amounts_check
      CHECK (
        commission_amount >= 0
        AND guide_payout >= 0
        AND deposit_amount >= 0
        AND balance_due >= 0
        AND abs((commission_amount + guide_payout) - price) < 0.01
        AND abs((deposit_amount + balance_due) - price) < 0.01
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_payment_status_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_payment_status_check
      CHECK (payment_status IN ('unpaid','deposit_pending','deposit_paid','paid','refunded','failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_guide_id ON public.bookings (guide_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tourist_id ON public.bookings (tourist_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_id ON public.bookings (tour_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings (payment_status);

-- 3) Canonicalize payments as server-owned transaction records.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'deposit',
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_event_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.payments
  ALTER COLUMN payment_method DROP DEFAULT;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending','processing','paid','refunded','failed'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_type_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_type_check
      CHECK (payment_type IN ('deposit','balance','full','refund'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_total_amount_positive_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_total_amount_positive_check CHECK (total_amount > 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_event_unique
  ON public.payments (provider, provider_event_id)
  WHERE provider IS NOT NULL AND provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);

-- 4) Browser clients can read only their own financial rows. They cannot create,
--    alter, delete, truncate, or otherwise author financial records directly.
DROP POLICY IF EXISTS anyone_can_insert_booking ON public.bookings;
DROP POLICY IF EXISTS guides_see_own_bookings ON public.bookings;
DROP POLICY IF EXISTS guides_update_own_bookings ON public.bookings;
DROP POLICY IF EXISTS booking_select_parties ON public.bookings;
DROP POLICY IF EXISTS booking_admin_all ON public.bookings;

CREATE POLICY booking_select_parties
ON public.bookings
FOR SELECT
TO authenticated
USING (
  tourist_id = (SELECT auth.uid())
  OR guide_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND (p.role = 'admin' OR p.is_admin IS TRUE)
  )
);

DROP POLICY IF EXISTS guides_see_own_payments ON public.payments;
DROP POLICY IF EXISTS tourists_insert_payments ON public.payments;
DROP POLICY IF EXISTS tourists_see_own_payments ON public.payments;
DROP POLICY IF EXISTS tourists_update_own_payments ON public.payments;
DROP POLICY IF EXISTS payment_select_parties ON public.payments;

CREATE POLICY payment_select_parties
ON public.payments
FOR SELECT
TO authenticated
USING (
  tourist_id = (SELECT auth.uid())
  OR guide_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND (p.role = 'admin' OR p.is_admin IS TRUE)
  )
);

REVOKE ALL ON TABLE public.bookings FROM anon, authenticated;
REVOKE ALL ON TABLE public.payments FROM anon, authenticated;
GRANT SELECT ON TABLE public.bookings TO authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;

-- 5) The selected guide/agency finalizes the confirmed proposal. This is the
--    only browser-accessible operation that creates a booking; all money is
--    derived inside the database from the locked request + selected proposal.
CREATE OR REPLACE FUNCTION public.finalize_selected_trip_slot(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id uuid := request_id;
  v_request public.trip_requests%ROWTYPE;
  v_slot public.trip_slots%ROWTYPE;
  v_people integer;
  v_days integer;
  v_total numeric;
  v_commission_rate numeric;
  v_commission_amount numeric;
  v_guide_payout numeric;
  v_deposit_percentage numeric;
  v_deposit_amount numeric;
  v_balance_due numeric;
  v_tourist_name text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = v_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip request not found';
  END IF;

  IF v_request.selected_guide_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Only the selected guide or agency can confirm this booking';
  END IF;

  -- Harmless retry after a successful booking finalization.
  IF v_request.status = 'booked' THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.request_id = v_request_id
        AND b.guide_id = (SELECT auth.uid())
    ) THEN
      RETURN true;
    END IF;
    RAISE EXCEPTION 'Trip request is booked but its booking record is missing';
  END IF;

  IF v_request.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed trip requests can be booked';
  END IF;

  SELECT s.* INTO v_slot
  FROM public.trip_slots s
  WHERE s.trip_request_id = v_request_id
    AND s.guide_id = (SELECT auth.uid())
    AND s.proposal_round = v_request.proposal_round
    AND s.status = 'selected'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No selected proposal was found for this booking';
  END IF;

  IF v_slot.price IS NULL OR v_slot.price <= 0 THEN
    RAISE EXCEPTION 'Selected proposal does not have a valid price';
  END IF;

  IF v_slot.price_type NOT IN ('per_person','entire_group') THEN
    RAISE EXCEPTION 'Selected proposal does not have a valid price type';
  END IF;

  IF v_slot.price_period NOT IN ('per_day','entire_trip') THEN
    RAISE EXCEPTION 'Selected proposal does not have a valid price period';
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
      CASE
        WHEN v_request.start_date IS NOT NULL AND v_request.end_date IS NOT NULL
          THEN NULLIF(v_request.end_date - v_request.start_date, 0)
        ELSE NULL
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

  IF v_commission_rate IS NULL OR v_commission_rate < 0 OR v_commission_rate > 1 THEN
    v_commission_rate := 0.15;
  END IF;

  SELECT CASE
           WHEN jsonb_typeof(s.value) = 'number' THEN (s.value::text)::numeric
           ELSE NULL
         END
  INTO v_deposit_percentage
  FROM public.site_settings s
  WHERE s.key = 'booking_deposit_percentage';

  IF v_deposit_percentage IS NULL OR v_deposit_percentage < 0 OR v_deposit_percentage > 1 THEN
    v_deposit_percentage := 0.20;
  END IF;

  v_commission_amount := round(v_total * v_commission_rate, 2);
  v_guide_payout := v_total - v_commission_amount;
  v_deposit_amount := round(v_total * v_deposit_percentage, 2);
  v_balance_due := v_total - v_deposit_amount;

  SELECT p.full_name INTO v_tourist_name
  FROM public.profiles p
  WHERE p.id = v_request.user_id;

  UPDATE public.trip_slots
  SET status = 'finalized',
      finalized_at = COALESCE(finalized_at, now())
  WHERE id = v_slot.id;

  INSERT INTO public.bookings (
    guide_id,
    tourist_id,
    tour_id,
    tourist_name,
    tourist_email,
    tour_title,
    start_date,
    end_date,
    num_people,
    price,
    currency,
    status,
    notes,
    request_id,
    commission_amount,
    guide_payout,
    deposit_amount,
    balance_due,
    contact_released,
    slot_id,
    quoted_unit_price,
    price_type,
    price_period,
    traveler_count,
    trip_duration_days,
    commission_rate,
    deposit_percentage,
    payment_status,
    booked_at
  ) VALUES (
    v_request.selected_guide_id,
    v_request.user_id,
    NULL,
    v_tourist_name,
    NULL,
    COALESCE(v_request.title, array_to_string(v_request.destination, ', '), 'Custom trip'),
    v_request.start_date,
    v_request.end_date,
    v_people,
    v_total,
    COALESCE(NULLIF(v_slot.currency, ''), NULLIF(v_request.currency, ''), 'USD'),
    'confirmed',
    NULL,
    v_request_id,
    v_commission_amount,
    v_guide_payout,
    v_deposit_amount,
    v_balance_due,
    false,
    v_slot.id,
    v_slot.price,
    v_slot.price_type,
    v_slot.price_period,
    v_people,
    v_days,
    v_commission_rate,
    v_deposit_percentage,
    'unpaid',
    now()
  );

  UPDATE public.trip_requests
  SET status = 'booked',
      updated_at = now()
  WHERE id = v_request_id;

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (
    v_request.user_id,
    'trip_booked',
    'Your selected guide or agency confirmed the trip. Your booking is ready for payment.',
    v_request_id
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_selected_trip_slot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_selected_trip_slot(uuid) TO authenticated;

-- 6) Keep the booking lifecycle aligned with the authoritative trip-request
--    lifecycle after creation. Financial payment state is intentionally not
--    changed here.
CREATE OR REPLACE FUNCTION public.sync_booking_status_from_trip_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'completed' THEN
      UPDATE public.bookings
      SET status = 'completed', updated_at = now()
      WHERE request_id = NEW.id;
    ELSIF NEW.status = 'cancelled' THEN
      UPDATE public.bookings
      SET status = 'cancelled', updated_at = now()
      WHERE request_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_booking_status_from_trip_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_booking_status_from_trip_request ON public.trip_requests;
CREATE TRIGGER trg_sync_booking_status_from_trip_request
AFTER UPDATE OF status ON public.trip_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_status_from_trip_request();

NOTIFY pgrst, 'reload schema';