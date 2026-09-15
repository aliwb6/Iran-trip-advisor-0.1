-- Traveler proposal queue, reversible Pending decisions, and irreversible Reject decisions.
-- New proposals are moderated first; approved offers are revealed to the traveler
-- oldest-first, two at a time. The first Pending/Reject action on a visible offer
-- permanently unlocks one additional queue position, up to the request proposal cap.

ALTER TABLE public.trip_slots
  ADD COLUMN IF NOT EXISTS traveler_decision text NOT NULL DEFAULT 'undecided',
  ADD COLUMN IF NOT EXISTS traveler_visible_at timestamptz,
  ADD COLUMN IF NOT EXISTS traveler_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS visibility_advanced_at timestamptz;

ALTER TABLE public.trip_slots
  DROP CONSTRAINT IF EXISTS trip_slots_traveler_decision_check;
ALTER TABLE public.trip_slots
  ADD CONSTRAINT trip_slots_traveler_decision_check
  CHECK (traveler_decision IN ('undecided', 'pending', 'rejected', 'approved'));

COMMENT ON COLUMN public.trip_slots.traveler_decision IS
  'Traveler decision for this proposal. Pending is reversible; rejected and approved are terminal.';
COMMENT ON COLUMN public.trip_slots.traveler_visible_at IS
  'When this admin-approved proposal first became visible to the traveler.';
COMMENT ON COLUMN public.trip_slots.visibility_advanced_at IS
  'Sticky marker proving this proposal already unlocked one later proposal in the traveler queue.';

CREATE INDEX IF NOT EXISTS idx_trip_slots_traveler_queue
  ON public.trip_slots(trip_request_id, proposal_round, approval_status, traveler_visible_at, accepted_at, id);

-- Existing approved proposals were already visible before this migration. Preserve
-- that visibility instead of unexpectedly hiding offers a traveler may have seen.
UPDATE public.trip_slots
SET traveler_visible_at = COALESCE(traveler_visible_at, approved_at, accepted_at, now())
WHERE approval_status = 'approved'
  AND traveler_visible_at IS NULL;

-- A submitted proposal consumes one of the request's proposal positions even if
-- the traveler later rejects it. For an exclusive direct-profile request that is
-- escalated after rejecting its original provider, the original rejected direct
-- offer is intentionally excluded so the marketplace can still collect five offers.
CREATE OR REPLACE FUNCTION private.trip_proposal_submission_count(
  p_request_id uuid,
  p_round integer
)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT count(*)::integer
  FROM public.trip_slots s
  JOIN public.trip_requests r ON r.id = s.trip_request_id
  WHERE s.trip_request_id = p_request_id
    AND s.proposal_round = p_round
    AND NOT (
      r.request_channel = 'direct_profile'
      AND r.direct_escalated_at IS NOT NULL
      AND r.direct_provider_id IS NOT NULL
      AND s.guide_id = r.direct_provider_id
      AND s.status = 'rejected'
    );
$$;

REVOKE ALL ON FUNCTION private.trip_proposal_submission_count(uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;

-- Providers cannot smuggle traveler lifecycle values into a proposal insert.
CREATE OR REPLACE FUNCTION public.mark_new_trip_proposal_pending_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.approval_status := 'pending_review';
  NEW.approved_at := NULL;
  NEW.approved_by := NULL;
  NEW.traveler_decision := 'undecided';
  NEW.traveler_visible_at := NULL;
  NEW.traveler_decided_at := NULL;
  NEW.visibility_advanced_at := NULL;
  RETURN NEW;
END;
$$;

-- Protect server-owned lifecycle fields even if table grants/policies change later.
CREATE OR REPLACE FUNCTION public.protect_trip_slot_lifecycle_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon','authenticated') AND (
    NEW.trip_request_id IS DISTINCT FROM OLD.trip_request_id OR
    NEW.guide_id IS DISTINCT FROM OLD.guide_id OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.proposal_round IS DISTINCT FROM OLD.proposal_round OR
    NEW.accepted_at IS DISTINCT FROM OLD.accepted_at OR
    NEW.finalized_at IS DISTINCT FROM OLD.finalized_at OR
    NEW.approval_status IS DISTINCT FROM OLD.approval_status OR
    NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
    NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
    NEW.traveler_decision IS DISTINCT FROM OLD.traveler_decision OR
    NEW.traveler_visible_at IS DISTINCT FROM OLD.traveler_visible_at OR
    NEW.traveler_decided_at IS DISTINCT FROM OLD.traveler_decided_at OR
    NEW.visibility_advanced_at IS DISTINCT FROM OLD.visibility_advanced_at
  ) THEN
    RAISE EXCEPTION 'Proposal lifecycle fields must be changed through the canonical trip request RPCs';
  END IF;
  RETURN NEW;
END;
$$;

-- Preserve the existing five-position proposal cap as a true submission cap.
CREATE OR REPLACE FUNCTION public.validate_trip_slot_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_submission_count integer;
  v_max integer;
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  IF v_user_id IS NULL OR NEW.guide_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Proposal provider must match the authenticated caller';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = NEW.trip_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip request not found';
  END IF;
  IF v_request.status NOT IN ('active','pending','open') THEN
    RAISE EXCEPTION 'This trip request is not accepting proposals';
  END IF;
  IF v_request.expires_at IS NOT NULL AND v_request.expires_at <= now() THEN
    RAISE EXCEPTION 'This trip request has expired';
  END IF;

  IF v_request.request_channel = 'direct_profile'
     AND v_request.direct_escalated_at IS NULL THEN
    IF NEW.guide_id IS DISTINCT FROM v_request.direct_provider_id THEN
      RAISE EXCEPTION 'This direct trip request is currently private to another provider';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = NEW.guide_id
        AND (
          (
            p.role IN ('guide', 'agency')
            AND p.is_approved IS TRUE
            AND p.is_rejected IS NOT TRUE
            AND p.is_published IS TRUE
            AND p.is_public IS TRUE
            AND p.accept_bookings IS TRUE
          )
          OR (
            v_request.source_tour_id IS NOT NULL
            AND (p.is_admin IS TRUE OR p.role = 'admin')
            AND EXISTS (
              SELECT 1
              FROM public.tours t
              WHERE t.id = v_request.source_tour_id
                AND t.status = 'published'
                AND (t.is_platform_tour IS TRUE OR t.owner_id = p.id)
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'Provider is not eligible to submit this direct proposal';
    END IF;

    IF v_request.direct_response_deadline IS NOT NULL
       AND v_request.direct_response_deadline <= now() THEN
      RAISE EXCEPTION 'The exclusive response window has ended';
    END IF;
  ELSE
    IF NOT private.marketplace_provider_is_eligible(NEW.guide_id, v_request.destination) THEN
      RAISE EXCEPTION 'Guide or agency is not eligible to submit proposals';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.trip_request_dispatches d
      WHERE d.trip_request_id = v_request.id
        AND d.provider_id = NEW.guide_id
        AND d.proposal_round = v_request.proposal_round
        AND d.status = 'pending'
        AND d.expires_at > now()
    ) THEN
      RAISE EXCEPTION 'This trip request was not dispatched to this provider';
    END IF;
  END IF;

  NEW.proposal_round := v_request.proposal_round;

  v_submission_count := private.trip_proposal_submission_count(
    v_request.id,
    v_request.proposal_round
  );

  v_max := COALESCE(v_request.max_proposals, 5);
  IF v_submission_count >= v_max THEN
    RAISE EXCEPTION 'This trip request has reached its proposal limit';
  END IF;

  UPDATE public.trip_request_dispatches
  SET status = 'responded', responded_at = now(), updated_at = now()
  WHERE trip_request_id = v_request.id
    AND provider_id = NEW.guide_id
    AND proposal_round = v_request.proposal_round
    AND status = 'pending';

  NEW.status := 'accepted';
  NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_trip_slot_insert()
  FROM PUBLIC, anon, authenticated, service_role;

-- Proposal submission updates counters only. The traveler is notified later,
-- when admin approval plus queue capacity make the offer actually visible.
CREATE OR REPLACE FUNCTION public.handle_trip_slot_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_req public.trip_requests%ROWTYPE;
  v_max integer;
BEGIN
  SELECT * INTO v_req
  FROM public.trip_requests
  WHERE id = NEW.trip_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_count := private.trip_proposal_submission_count(
    NEW.trip_request_id,
    v_req.proposal_round
  );
  v_max := COALESCE(v_req.max_proposals, 5);

  UPDATE public.trip_requests
  SET proposals_count = v_count,
      status = CASE
        WHEN v_count >= v_max AND status IN ('active','pending','open') THEN 'proposals_ready'
        ELSE status
      END,
      updated_at = now()
  WHERE id = NEW.trip_request_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_trip_slot_insert()
  FROM PUBLIC, anon, authenticated, service_role;

-- Reveal the oldest approved proposals until the traveler has consumed the
-- currently unlocked queue positions. The first two positions are free; each
-- proposal whose visibility_advanced_at is set contributes exactly one more.
CREATE OR REPLACE FUNCTION private.reveal_available_trip_proposals(
  p_request_id uuid,
  p_round integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.trip_requests%ROWTYPE;
  v_limit integer;
  v_visible integer;
  v_needed integer;
  v_revealed integer := 0;
  v_row record;
  v_provider_name text;
  v_provider_role text;
  v_destination text;
  v_sender text;
BEGIN
  SELECT * INTO v_request
  FROM public.trip_requests r
  WHERE r.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR p_round <> v_request.proposal_round THEN
    RETURN 0;
  END IF;

  SELECT LEAST(
    COALESCE(v_request.max_proposals, 5),
    2 + count(*)::integer
  )
  INTO v_limit
  FROM public.trip_slots s
  WHERE s.trip_request_id = p_request_id
    AND s.proposal_round = p_round
    AND s.visibility_advanced_at IS NOT NULL;

  SELECT count(*)::integer
  INTO v_visible
  FROM public.trip_slots s
  WHERE s.trip_request_id = p_request_id
    AND s.proposal_round = p_round
    AND s.approval_status = 'approved'
    AND s.traveler_visible_at IS NOT NULL;

  v_needed := GREATEST(0, v_limit - v_visible);
  IF v_needed = 0 THEN
    RETURN 0;
  END IF;

  v_destination := COALESCE(
    NULLIF(array_to_string(v_request.destination, ', '), ''),
    'Iran'
  );

  FOR v_row IN
    WITH candidates AS (
      SELECT s.id
      FROM public.trip_slots s
      WHERE s.trip_request_id = p_request_id
        AND s.proposal_round = p_round
        AND s.approval_status = 'approved'
        AND s.traveler_visible_at IS NULL
        AND s.status IN ('accepted', 'chatting')
      ORDER BY s.accepted_at ASC NULLS LAST, s.id ASC
      LIMIT v_needed
      FOR UPDATE
    )
    UPDATE public.trip_slots s
    SET traveler_visible_at = now()
    FROM candidates c
    WHERE s.id = c.id
    RETURNING s.id, s.guide_id
  LOOP
    v_revealed := v_revealed + 1;

    SELECT p.full_name, p.role::text
    INTO v_provider_name, v_provider_role
    FROM public.profiles p
    WHERE p.id = v_row.guide_id;

    IF lower(COALESCE(v_provider_role, '')) = 'agency' THEN
      v_sender := CASE
        WHEN NULLIF(btrim(v_provider_name), '') IS NOT NULL
          THEN 'Travel agency ' || btrim(v_provider_name)
        ELSE 'A travel agency'
      END;
    ELSE
      v_sender := CASE
        WHEN NULLIF(btrim(v_provider_name), '') IS NOT NULL
          THEN 'Guide ' || btrim(v_provider_name)
        ELSE 'A local guide'
      END;
    END IF;

    IF v_request.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, message, related_request_id)
      VALUES (
        v_request.user_id,
        'proposal_received',
        v_sender || ' has an admin-approved proposal ready for your trip to ' ||
          v_destination || '. Tap to review it.',
        p_request_id
      );
    END IF;
  END LOOP;

  RETURN v_revealed;
END;
$$;

REVOKE ALL ON FUNCTION private.reveal_available_trip_proposals(uuid, integer)
  FROM PUBLIC, anon, authenticated, service_role;

-- Travelers may only read proposals that passed moderation AND were released by
-- the server-side queue. Providers retain their own records; admins retain all.
DROP POLICY IF EXISTS trip_slots_authenticated_select ON public.trip_slots;
CREATE POLICY trip_slots_authenticated_select
ON public.trip_slots FOR SELECT TO authenticated
USING (
  guide_id = (SELECT auth.uid())
  OR private.current_user_is_admin()
  OR (
    approval_status = 'approved'
    AND traveler_visible_at IS NOT NULL
    AND private.current_user_owns_trip_request(trip_request_id)
  )
);

-- Admin moderation now feeds the traveler queue instead of exposing every
-- approved proposal immediately.
CREATE OR REPLACE FUNCTION public.review_trip_proposal(proposal_id uuid, decision text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_decision text := lower(trim(decision));
  v_request_id uuid;
  v_round integer;
  v_status text;
BEGIN
  IF NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required';
  END IF;
  IF v_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid proposal review decision';
  END IF;

  SELECT s.trip_request_id, s.proposal_round, s.status
  INTO v_request_id, v_round, v_status
  FROM public.trip_slots s
  WHERE s.id = proposal_id;

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  PERFORM 1
  FROM public.trip_requests r
  WHERE r.id = v_request_id
  FOR UPDATE;

  IF v_decision = 'approved' AND v_status NOT IN ('accepted', 'chatting') THEN
    RAISE EXCEPTION 'Only an active proposal can be approved';
  END IF;

  UPDATE public.trip_slots
  SET approval_status = v_decision,
      approved_at = CASE WHEN v_decision = 'approved' THEN now() ELSE NULL END,
      approved_by = CASE WHEN v_decision = 'approved' THEN (SELECT auth.uid()) ELSE NULL END
  WHERE id = proposal_id
    AND approval_status = 'pending_review';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_decision = 'approved' THEN
    PERFORM private.reveal_available_trip_proposals(v_request_id, v_round);
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.review_trip_proposal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_trip_proposal(uuid, text) TO authenticated;

-- Pending is reversible, but its first activation permanently consumes one
-- queue-advance credit so toggling Pending cannot unlock multiple later offers.
CREATE OR REPLACE FUNCTION public.set_trip_proposal_pending(
  proposal_id uuid,
  is_pending boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_request public.trip_requests%ROWTYPE;
  v_slot public.trip_slots%ROWTYPE;
  v_first_advance boolean := false;
  v_provider public.profiles%ROWTYPE;
  v_destination text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT s.trip_request_id, s.proposal_round
  INTO v_slot.trip_request_id, v_slot.proposal_round
  FROM public.trip_slots s
  WHERE s.id = proposal_id;

  IF v_slot.trip_request_id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests r
  WHERE r.id = v_slot.trip_request_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_request.user_id <> v_user_id
     OR v_slot.proposal_round <> v_request.proposal_round THEN
    RAISE EXCEPTION 'Not authorized to change this proposal decision';
  END IF;

  SELECT * INTO v_slot
  FROM public.trip_slots s
  WHERE s.id = proposal_id
  FOR UPDATE;

  IF v_slot.approval_status <> 'approved'
     OR v_slot.traveler_visible_at IS NULL THEN
    RAISE EXCEPTION 'This proposal is not available for traveler decisions';
  END IF;

  IF v_slot.status NOT IN ('accepted', 'chatting') THEN
    RAISE EXCEPTION 'This proposal can no longer be changed';
  END IF;

  IF v_slot.traveler_decision = 'rejected' THEN
    RAISE EXCEPTION 'A rejected proposal cannot be restored';
  END IF;
  IF v_slot.traveler_decision = 'approved' THEN
    RAISE EXCEPTION 'An approved proposal cannot be moved to Pending';
  END IF;

  IF is_pending THEN
    IF v_slot.traveler_decision = 'pending' THEN
      RETURN true;
    END IF;

    v_first_advance := v_slot.visibility_advanced_at IS NULL;

    UPDATE public.trip_slots
    SET traveler_decision = 'pending',
        traveler_decided_at = now(),
        visibility_advanced_at = COALESCE(visibility_advanced_at, now())
    WHERE id = proposal_id;

    -- Explain Pending once to the provider. Re-toggling the same proposal does
    -- not spam notifications/email and does not unlock another queue position.
    IF v_first_advance THEN
      SELECT * INTO v_provider
      FROM public.profiles p
      WHERE p.id = v_slot.guide_id;

      INSERT INTO public.notifications (user_id, type, message, related_request_id)
      VALUES (
        v_slot.guide_id,
        'proposal_pending',
        'The traveler marked your proposal as Pending while comparing other approved offers. Your proposal remains active and can still be approved later; no action is required from you.',
        v_request.id
      );

      IF v_provider.notify_email IS TRUE
         AND NULLIF(btrim(v_provider.email), '') IS NOT NULL THEN
        INSERT INTO public.email_outbox (
          recipient_user_id,
          recipient_email,
          template,
          payload,
          unique_key
        )
        VALUES (
          v_provider.id,
          v_provider.email,
          'proposal_pending',
          jsonb_build_object(
            'request_id', v_request.id,
            'proposal_id', proposal_id,
            'provider_name', v_provider.full_name,
            'destination', v_request.destination
          ),
          'proposal-pending:' || proposal_id::text
        )
        ON CONFLICT (unique_key) DO NOTHING;
      END IF;

      PERFORM private.reveal_available_trip_proposals(
        v_request.id,
        v_request.proposal_round
      );
    END IF;
  ELSE
    IF v_slot.traveler_decision = 'pending' THEN
      UPDATE public.trip_slots
      SET traveler_decision = 'undecided',
          traveler_decided_at = now()
      WHERE id = proposal_id;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_trip_proposal_pending(uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_trip_proposal_pending(uuid, boolean)
  TO authenticated;

-- Reject is irreversible. It keeps the proposal visible as history, unlocks the
-- next queue position at most once, and no longer creates a sixth proposal by
-- freeing a responded marketplace dispatch slot.
CREATE OR REPLACE FUNCTION public.reject_trip_proposal(proposal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id uuid;
  v_guide_id uuid;
  v_slot_round integer;
  v_approval_status text;
  v_visible_at timestamptz;
  v_traveler_decision text;
  v_request public.trip_requests%ROWTYPE;
  v_count integer;
  v_max integer;
  v_escalate_direct boolean := false;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT s.trip_request_id,
         s.guide_id,
         s.proposal_round,
         s.approval_status,
         s.traveler_visible_at,
         s.traveler_decision
  INTO v_request_id,
       v_guide_id,
       v_slot_round,
       v_approval_status,
       v_visible_at,
       v_traveler_decision
  FROM public.trip_slots s
  WHERE s.id = proposal_id;

  IF v_request_id IS NULL OR v_guide_id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests r
  WHERE r.id = v_request_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_request.user_id <> (SELECT auth.uid())
     OR v_slot_round <> v_request.proposal_round THEN
    RAISE EXCEPTION 'Not authorized to reject this proposal';
  END IF;

  IF v_approval_status <> 'approved' OR v_visible_at IS NULL THEN
    RAISE EXCEPTION 'This proposal is not available for traveler decisions';
  END IF;
  IF v_traveler_decision = 'rejected' THEN
    RAISE EXCEPTION 'This proposal was already rejected and cannot be restored';
  END IF;
  IF v_traveler_decision = 'approved' THEN
    RAISE EXCEPTION 'An approved proposal cannot be rejected';
  END IF;

  UPDATE public.trip_slots
  SET status = 'rejected',
      traveler_decision = 'rejected',
      traveler_decided_at = now(),
      visibility_advanced_at = COALESCE(visibility_advanced_at, now())
  WHERE id = proposal_id
    AND trip_request_id = v_request_id
    AND guide_id = v_guide_id
    AND proposal_round = v_request.proposal_round
    AND status IN ('accepted', 'chatting');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This proposal can no longer be rejected';
  END IF;

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (
    v_guide_id,
    'proposal_rejected',
    'The traveler rejected your proposal for this trip request. This decision is final.',
    v_request_id
  );

  -- A direct-profile request still escalates after its exclusive provider is
  -- rejected. Marketplace proposals that were already submitted do not free a
  -- dispatch slot, so a sixth proposal is not introduced by traveler rejection.
  IF v_request.request_channel = 'direct_profile'
     AND v_request.direct_escalated_at IS NULL THEN
    v_escalate_direct := true;

    UPDATE public.trip_requests
    SET direct_escalated_at = now(),
        direct_response_deadline = LEAST(COALESCE(direct_response_deadline, now()), now()),
        escalation_notified_provider_ids = '{}'::uuid[],
        max_proposals = 5,
        status = 'active',
        updated_at = now()
    WHERE id = v_request_id;
  END IF;

  v_count := private.trip_proposal_submission_count(
    v_request_id,
    v_request.proposal_round
  );

  SELECT COALESCE(max_proposals, 5)
  INTO v_max
  FROM public.trip_requests
  WHERE id = v_request_id;

  UPDATE public.trip_requests
  SET proposals_count = v_count,
      status = CASE
        WHEN v_escalate_direct THEN 'active'
        WHEN status = 'proposals_ready' AND v_count < v_max THEN 'active'
        ELSE status
      END,
      updated_at = now()
  WHERE id = v_request_id;

  PERFORM private.reveal_available_trip_proposals(
    v_request_id,
    v_request.proposal_round
  );

  IF v_escalate_direct THEN
    PERFORM public.dispatch_trip_request(v_request_id);
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_trip_proposal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_trip_proposal(uuid) TO authenticated;

-- Approving a proposal is the terminal traveler decision and is only possible
-- for an admin-approved proposal that the queue has actually revealed.
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
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request
  FROM public.trip_requests
  WHERE id = v_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.user_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to select a guide for this request';
  END IF;

  IF v_request.status IN ('confirmed','closed','booked','completed','expired','cancelled') THEN
    RAISE EXCEPTION 'This trip request can no longer change its selected guide';
  END IF;

  IF v_request.expires_at IS NOT NULL AND v_request.expires_at <= now() THEN
    RAISE EXCEPTION 'This trip request has expired';
  END IF;

  SELECT id INTO v_winner_slot
  FROM public.trip_slots
  WHERE trip_request_id = v_request_id
    AND guide_id = v_selected_guide_id
    AND proposal_round = v_request.proposal_round
    AND status IN ('accepted','chatting')
    AND approval_status = 'approved'
    AND traveler_visible_at IS NOT NULL
    AND traveler_decision <> 'rejected'
  FOR UPDATE;

  IF v_winner_slot IS NULL THEN
    RAISE EXCEPTION 'Selected provider does not have an available approved proposal for this request';
  END IF;

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  SELECT loser.provider_id,
         'request_filled',
         'This trip request expired for you because the traveler selected another guide or agency.',
         v_request_id
  FROM (
    SELECT s.guide_id AS provider_id
    FROM public.trip_slots s
    WHERE s.trip_request_id = v_request_id
      AND s.proposal_round = v_request.proposal_round
      AND s.guide_id <> v_selected_guide_id
      AND s.status IN ('accepted','chatting')
    UNION
    SELECT d.provider_id
    FROM public.trip_request_dispatches d
    WHERE d.trip_request_id = v_request_id
      AND d.proposal_round = v_request.proposal_round
      AND d.provider_id <> v_selected_guide_id
      AND d.status IN ('pending','responded')
  ) AS loser;

  UPDATE public.trip_slots
  SET status = 'rejected'
  WHERE trip_request_id = v_request_id
    AND proposal_round = v_request.proposal_round
    AND guide_id <> v_selected_guide_id
    AND status IN ('accepted','chatting');

  UPDATE public.trip_request_dispatches
  SET status = 'expired', updated_at = now()
  WHERE trip_request_id = v_request_id
    AND proposal_round = v_request.proposal_round
    AND provider_id <> v_selected_guide_id
    AND status IN ('pending','responded');

  UPDATE public.trip_slots
  SET status = 'selected',
      traveler_decision = 'approved',
      traveler_decided_at = now()
  WHERE id = v_winner_slot;

  UPDATE public.trip_requests
  SET status = 'confirmed',
      selected_guide_id = v_selected_guide_id,
      proposals_count = 1,
      updated_at = now()
  WHERE id = v_request_id;

  INSERT INTO public.notifications (user_id, type, message, related_request_id)
  VALUES (
    v_selected_guide_id,
    'guide_selected',
    'Congratulations! A traveler selected you for their trip request.',
    v_request_id
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.select_trip_guide(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_trip_guide(uuid, uuid) TO authenticated;

-- Extend the existing Resend outbox worker with an explanatory Pending email.
CREATE OR REPLACE FUNCTION public.process_email_outbox(batch_size integer DEFAULT 20)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.email_outbox%ROWTYPE;
  v_api_key text;
  v_request_id bigint;
  v_trip public.trip_requests%ROWTYPE;
  v_lang text;
  v_template_alias text;
  v_destination text;
  v_start_date text;
  v_end_date text;
  v_deadline text;
  v_cta_url text;
  v_variables jsonb;
  v_body jsonb;
  v_subject text;
  v_text text;
  v_processed integer := 0;
BEGIN
  SELECT decrypted_secret INTO v_api_key
  FROM vault.decrypted_secrets
  WHERE name = 'resend_email_worker_api_key'
  LIMIT 1;

  IF NULLIF(v_api_key, '') IS NULL THEN
    RAISE EXCEPTION 'Resend API key is not configured in Vault';
  END IF;

  FOR v_row IN
    SELECT e.*
    FROM public.email_outbox e
    WHERE e.status IN ('pending', 'failed')
      AND e.available_at <= now()
      AND e.attempts < 5
    ORDER BY e.available_at, e.created_at
    LIMIT GREATEST(1, LEAST(batch_size, 100))
    FOR UPDATE SKIP LOCKED
  LOOP
    v_lang := 'en';
    IF v_row.recipient_user_id IS NOT NULL THEN
      SELECT COALESCE(p.preferred_language, 'en') INTO v_lang
      FROM public.profiles p WHERE p.id = v_row.recipient_user_id;
    END IF;
    IF v_lang NOT IN ('en', 'fa', 'ar') THEN v_lang := 'en'; END IF;

    v_trip := NULL;
    IF NULLIF(v_row.payload->>'request_id', '') IS NOT NULL THEN
      BEGIN
        SELECT * INTO v_trip
        FROM public.trip_requests r
        WHERE r.id = (v_row.payload->>'request_id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_trip := NULL;
      END;
    END IF;

    SELECT COALESCE(string_agg(value, ', '), 'Iran') INTO v_destination
    FROM jsonb_array_elements_text(
      COALESCE(to_jsonb(v_trip.destination), v_row.payload->'destination', '[]'::jsonb)
    );

    v_start_date := COALESCE(v_trip.start_date::text, 'Not specified');
    v_end_date := COALESCE(v_trip.end_date::text, 'Not specified');
    v_deadline := COALESCE(
      to_char(v_trip.direct_response_deadline AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC'),
      v_row.payload->>'deadline',
      'Within 12 hours'
    );

    v_cta_url := CASE
      WHEN v_trip.id IS NOT NULL
        THEN 'https://irantripadvisor.net/dashboard/requests/' || v_trip.id::text || '?action=proposal'
      ELSE 'https://irantripadvisor.net/dashboard/requests'
    END;

    IF v_row.template = 'direct_trip_request' THEN
      v_template_alias := 'direct-trip-request-' || v_lang;
      v_variables := jsonb_build_object(
        'PROVIDER_NAME', COALESCE(NULLIF(v_row.payload->>'provider_name', ''), 'Guide'),
        'DESTINATION', v_destination,
        'START_DATE', v_start_date,
        'END_DATE', v_end_date,
        'DEADLINE', v_deadline,
        'CTA_URL', v_cta_url
      );
      v_body := jsonb_build_object(
        'from', 'Iran Trip Advisor <notifications@irantripadvisor.net>',
        'to', jsonb_build_array(v_row.recipient_email),
        'template', jsonb_build_object('id', v_template_alias, 'variables', v_variables)
      );
    ELSIF v_row.template = 'trip_request_escalation_invite' THEN
      v_template_alias := 'trip-request-escalation-' || v_lang;
      v_variables := jsonb_build_object(
        'GUIDE_NAME', COALESCE(NULLIF(v_row.payload->>'guide_name', ''), 'Guide'),
        'DESTINATION', v_destination,
        'START_DATE', v_start_date,
        'END_DATE', v_end_date,
        'CTA_URL', v_cta_url
      );
      v_body := jsonb_build_object(
        'from', 'Iran Trip Advisor <notifications@irantripadvisor.net>',
        'to', jsonb_build_array(v_row.recipient_email),
        'template', jsonb_build_object('id', v_template_alias, 'variables', v_variables)
      );
    ELSIF v_row.template = 'proposal_pending' THEN
      IF v_lang = 'fa' THEN
        v_subject := 'پیشنهاد شما در حالت Pending قرار گرفت';
        v_text := 'سلام ' || COALESCE(NULLIF(v_row.payload->>'provider_name', ''), 'راهنما') || E',\n\n'
          || 'توریست پیشنهاد شما برای سفر به ' || v_destination || ' را رد نکرده است؛ '
          || 'او فعلاً پیشنهاد را در حالت Pending قرار داده تا آن را با پیشنهادهای تأییدشده دیگر مقایسه کند. '
          || 'پیشنهاد شما همچنان فعال است و توریست می‌تواند بعداً آن را تأیید کند. در حال حاضر نیازی به اقدام از طرف شما نیست.'
          || E'\n\nمشاهده درخواست: ' || v_cta_url
          || E'\n\nIran Trip Advisor';
      ELSIF v_lang = 'ar' THEN
        v_subject := 'تم وضع عرضك في حالة Pending';
        v_text := 'مرحباً ' || COALESCE(NULLIF(v_row.payload->>'provider_name', ''), 'Guide') || E',\n\n'
          || 'لم يرفض المسافر عرضك لرحلته إلى ' || v_destination || '. '
          || 'لقد وضعه مؤقتاً في حالة Pending أثناء مقارنة العروض الأخرى المعتمدة. '
          || 'يبقى عرضك فعالاً ويمكن للمسافر الموافقة عليه لاحقاً. لا يلزمك اتخاذ أي إجراء الآن.'
          || E'\n\nعرض الطلب: ' || v_cta_url
          || E'\n\nIran Trip Advisor';
      ELSE
        v_subject := 'Your proposal is Pending';
        v_text := 'Hello ' || COALESCE(NULLIF(v_row.payload->>'provider_name', ''), 'Guide') || E',\n\n'
          || 'The traveler has not rejected your proposal for the trip to ' || v_destination || '. '
          || 'They marked it as Pending while comparing other admin-approved offers. '
          || 'Your proposal remains active and can still be approved later. No action is required from you right now.'
          || E'\n\nView the request: ' || v_cta_url
          || E'\n\nIran Trip Advisor';
      END IF;

      v_body := jsonb_build_object(
        'from', 'Iran Trip Advisor <notifications@irantripadvisor.net>',
        'to', jsonb_build_array(v_row.recipient_email),
        'subject', v_subject,
        'text', v_text
      );
    ELSE
      v_body := jsonb_build_object(
        'from', 'Iran Trip Advisor <notifications@irantripadvisor.net>',
        'to', jsonb_build_array(v_row.recipient_email),
        'subject', 'Iran Trip Advisor notification',
        'text', 'You have a new notification from Iran Trip Advisor.\n\nhttps://irantripadvisor.net'
      );
    END IF;

    SELECT net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_api_key,
        'Content-Type', 'application/json',
        'Idempotency-Key', v_row.unique_key
      ),
      body := v_body,
      timeout_milliseconds := 10000
    ) INTO v_request_id;

    UPDATE public.email_outbox
    SET status = 'sending',
        attempts = attempts + 1,
        provider_request_id = v_request_id,
        last_attempt_at = now(),
        last_error = NULL
    WHERE id = v_row.id;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.process_email_outbox(integer)
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
