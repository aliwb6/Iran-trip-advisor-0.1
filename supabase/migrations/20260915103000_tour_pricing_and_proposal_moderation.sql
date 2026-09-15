-- Tour price units and a mandatory moderation gate for provider proposals.

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS price_basis text NOT NULL DEFAULT 'per_person';

ALTER TABLE public.tours
  DROP CONSTRAINT IF EXISTS tours_price_basis_check;
ALTER TABLE public.tours
  ADD CONSTRAINT tours_price_basis_check
  CHECK (price_basis IN ('per_person', 'per_day'));

-- Existing offers remain visible. New offers are put into review by the trigger.
ALTER TABLE public.trip_slots
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.trip_slots
  DROP CONSTRAINT IF EXISTS trip_slots_approval_status_check;
ALTER TABLE public.trip_slots
  ADD CONSTRAINT trip_slots_approval_status_check
  CHECK (approval_status IN ('pending_review', 'approved', 'rejected'));

CREATE OR REPLACE FUNCTION public.mark_new_trip_proposal_pending_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.approval_status := 'pending_review';
  NEW.approved_at := NULL;
  NEW.approved_by := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trip_slot_pending_review ON public.trip_slots;
CREATE TRIGGER trg_trip_slot_pending_review
  BEFORE INSERT ON public.trip_slots
  FOR EACH ROW EXECUTE FUNCTION public.mark_new_trip_proposal_pending_review();

-- The traveler sees only reviewed offers; providers retain access to their own
-- offers and administrators retain access to the moderation queue.
DROP POLICY IF EXISTS trip_slots_authenticated_select ON public.trip_slots;
CREATE POLICY trip_slots_authenticated_select ON public.trip_slots FOR SELECT TO authenticated
USING (
  guide_id = (SELECT auth.uid())
  OR private.current_user_is_admin()
  OR (approval_status = 'approved' AND private.current_user_owns_trip_request(trip_request_id))
);

CREATE OR REPLACE FUNCTION public.review_trip_proposal(proposal_id uuid, decision text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_decision text := lower(trim(decision));
BEGIN
  IF NOT private.current_user_is_admin() THEN RAISE EXCEPTION 'Administrator access is required'; END IF;
  IF v_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Invalid proposal review decision'; END IF;
  UPDATE public.trip_slots
  SET approval_status = v_decision,
      approved_at = CASE WHEN v_decision = 'approved' THEN now() ELSE NULL END,
      approved_by = CASE WHEN v_decision = 'approved' THEN (SELECT auth.uid()) ELSE NULL END
  WHERE id = proposal_id AND approval_status = 'pending_review';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.review_trip_proposal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_trip_proposal(uuid, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
