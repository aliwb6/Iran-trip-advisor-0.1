-- Phase 3A follow-up: preserve immutable financial history and remove
-- contradictory ON DELETE SET NULL/CASCADE behavior from required booking links.

ALTER TABLE public.bookings
  ALTER COLUMN quoted_unit_price SET NOT NULL,
  ALTER COLUMN price_type SET NOT NULL,
  ALTER COLUMN price_period SET NOT NULL,
  ALTER COLUMN traveler_count SET NOT NULL,
  ALTER COLUMN trip_duration_days SET NOT NULL,
  ALTER COLUMN commission_rate SET NOT NULL,
  ALTER COLUMN deposit_percentage SET NOT NULL,
  ALTER COLUMN booked_at SET NOT NULL,
  ALTER COLUMN booked_at SET DEFAULT now();

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_guide_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_guide_id_fkey
  FOREIGN KEY (guide_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_tourist_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_tourist_id_fkey
  FOREIGN KEY (tourist_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_request_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_request_id_fkey
  FOREIGN KEY (request_id) REFERENCES public.trip_requests(id) ON DELETE RESTRICT;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_slot_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_slot_id_fkey
  FOREIGN KEY (slot_id) REFERENCES public.trip_slots(id) ON DELETE RESTRICT;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_guide_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_guide_id_fkey
  FOREIGN KEY (guide_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_tourist_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_tourist_id_fkey
  FOREIGN KEY (tourist_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.set_payment_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_payment_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.set_payment_updated_at();

NOTIFY pgrst, 'reload schema';