-- Phase 4F: close authorization and row-integrity gaps without changing the
-- existing proposal lifecycle RPCs or the intentional signup/onboarding flow.

-- ---------------------------------------------------------------------------
-- profiles: privileged state is admin/server-owned. New users may choose a
-- provider role during signup or move from traveler/tourist into provider
-- onboarding, but that transition never carries approval or admin state.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_authorization_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_caller_is_admin boolean := false;
  v_role_transition_is_onboarding boolean := false;
  v_license_resubmission boolean := false;
BEGIN
  -- Service/database-owned work remains available. Browser administrators are
  -- recognized from the already-persisted caller profile, never NEW values.
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  v_caller_is_admin := COALESCE((SELECT private.current_user_is_admin()), false);
  IF v_caller_is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role NOT IN ('traveler', 'tourist', 'guide', 'agency')
       OR COALESCE(NEW.is_admin, false) IS TRUE
       OR COALESCE(NEW.is_verified, false) IS TRUE
       OR COALESCE(NEW.is_approved, false) IS TRUE
       OR COALESCE(NEW.is_rejected, false) IS TRUE
       OR COALESCE(NEW.is_published, false) IS TRUE
       OR NEW.approval_rejection_reason IS NOT NULL
       OR NEW.approval_reviewed_at IS NOT NULL
       OR NEW.license_status IS DISTINCT FROM 'not_uploaded'
       OR NEW.commission_rate IS DISTINCT FROM 0.15::numeric THEN
      RAISE EXCEPTION 'A new profile cannot contain privileged authorization or moderation state'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN NEW;
  END IF;

  v_role_transition_is_onboarding := (
    OLD.role IN ('traveler', 'tourist')
    AND NEW.role IN ('traveler', 'tourist', 'guide', 'agency')
  );

  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT v_role_transition_is_onboarding THEN
    RAISE EXCEPTION 'Profile role changes are restricted to provider onboarding'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A pending-review transition is the one self-service moderation change the
  -- current UI requires after uploading a new license object. It grants no
  -- provider eligibility and cannot clear the profile-level rejection flag.
  v_license_resubmission := (
    NEW.license_status = 'pending_review'
    AND NEW.role IN ('guide', 'agency')
    AND NULLIF(btrim(NEW.license_url), '') IS NOT NULL
    AND NEW.license_url IS DISTINCT FROM OLD.license_url
  );

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_approved IS DISTINCT FROM OLD.is_approved
     OR NEW.is_rejected IS DISTINCT FROM OLD.is_rejected
     OR NEW.is_published IS DISTINCT FROM OLD.is_published
     OR NEW.approval_rejection_reason IS DISTINCT FROM OLD.approval_rejection_reason
     OR NEW.approval_reviewed_at IS DISTINCT FROM OLD.approval_reviewed_at
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR (
       NEW.license_status IS DISTINCT FROM OLD.license_status
       AND NOT v_license_resubmission
     ) THEN
    RAISE EXCEPTION 'Only an administrator or server process may change profile authorization or moderation fields'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- An onboarding role change is allowed only while every privilege-bearing
  -- value remains non-privileged.
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NEW.role IN ('guide', 'agency')
     AND (
       COALESCE(NEW.is_admin, false) IS TRUE
       OR COALESCE(NEW.is_verified, false) IS TRUE
       OR COALESCE(NEW.is_approved, false) IS TRUE
       OR COALESCE(NEW.is_rejected, false) IS TRUE
       OR COALESCE(NEW.is_published, false) IS TRUE
       OR NEW.approval_rejection_reason IS NOT NULL
       OR NEW.approval_reviewed_at IS NOT NULL
       OR NEW.license_status IN ('verified', 'rejected')
     ) THEN
    RAISE EXCEPTION 'Provider onboarding must begin in an unapproved state'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_authorization_fields()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_profiles_authorization_guard ON public.profiles;
CREATE TRIGGER trg_profiles_authorization_guard
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_authorization_fields();

-- Auth metadata is user-controlled. Preserve the supported signup roles only;
-- all privileged/moderation fields continue to come from database defaults.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_signup_role text;
BEGIN
  v_signup_role := CASE lower(COALESCE(NEW.raw_user_meta_data->>'role', 'traveler'))
    WHEN 'traveler' THEN 'traveler'
    WHEN 'tourist' THEN 'tourist'
    WHEN 'guide' THEN 'guide'
    WHEN 'agency' THEN 'agency'
    ELSE 'traveler'
  END;

  INSERT INTO public.profiles (id, email, full_name, role, gender)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    v_signup_role,
    NEW.raw_user_meta_data->>'gender'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- trip_slots: no browser source performs a direct UPDATE. Proposal creation is
-- still direct INSERT; all selection/rejection/finalization changes stay behind
-- the existing SECURITY DEFINER lifecycle RPCs.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS trip_slots_authenticated_update ON public.trip_slots;
REVOKE UPDATE ON TABLE public.trip_slots FROM authenticated;

DROP POLICY IF EXISTS trip_slots_authenticated_insert ON public.trip_slots;
CREATE POLICY trip_slots_authenticated_insert
ON public.trip_slots
FOR INSERT
TO authenticated
WITH CHECK (
  guide_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('guide', 'agency')
      AND p.is_approved IS TRUE
      AND p.is_rejected IS NOT TRUE
  )
);

-- ---------------------------------------------------------------------------
-- messages: direct messages bind sender identity to auth.uid(); AI history is
-- a separate owner-scoped mode with null participant IDs. Direct-message
-- recipients can set only is_read, while an AI conversation owner retains the
-- existing content-edit/history-delete behavior.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.current_user_can_message(p_recipient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND p_recipient_id IS NOT NULL
    AND p_recipient_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles recipient
      WHERE recipient.id = p_recipient_id
    )
    AND (
      -- The product intentionally permits first contact with a public,
      -- approved provider.
      EXISTS (
        SELECT 1
        FROM public.profiles recipient
        WHERE recipient.id = p_recipient_id
          AND recipient.role IN ('guide', 'agency')
          AND recipient.is_approved IS TRUE
          AND recipient.is_rejected IS NOT TRUE
          AND recipient.is_published IS TRUE
          AND recipient.is_public IS TRUE
      )
      -- Once either participant has sent a direct message, replies remain
      -- available even if public-provider visibility later changes.
      OR EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE (m.sender_id = (SELECT auth.uid()) AND m.receiver_id = p_recipient_id)
           OR (m.sender_id = p_recipient_id AND m.receiver_id = (SELECT auth.uid()))
      )
      -- A provider may initiate contact with a traveler whose request they are
      -- selected for, directly invited to, or have proposed on.
      OR EXISTS (
        SELECT 1
        FROM public.trip_requests tr
        WHERE tr.user_id = p_recipient_id
          AND (
            tr.selected_guide_id = (SELECT auth.uid())
            OR tr.direct_provider_id = (SELECT auth.uid())
            OR EXISTS (
              SELECT 1
              FROM public.trip_slots s
              WHERE s.trip_request_id = tr.id
                AND s.guide_id = (SELECT auth.uid())
            )
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.tour_requests tr
        WHERE tr.tourist_id = p_recipient_id
          AND tr.guide_id = (SELECT auth.uid())
      )
    );
$$;

REVOKE ALL ON FUNCTION private.current_user_can_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_can_message(uuid) TO authenticated;

DROP POLICY IF EXISTS messages_authenticated_insert ON public.messages;
CREATE POLICY messages_authenticated_insert
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    conversation_id IS NULL
    AND sender_id = (SELECT auth.uid())
    AND receiver_id IS NOT NULL
    AND (SELECT private.current_user_can_message(receiver_id))
  )
  OR
  (
    conversation_id IS NOT NULL
    AND sender_id IS NULL
    AND receiver_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
);

DROP POLICY IF EXISTS messages_authenticated_update ON public.messages;
CREATE POLICY messages_authenticated_update
ON public.messages
FOR UPDATE
TO authenticated
USING (
  (
    conversation_id IS NULL
    AND receiver_id = (SELECT auth.uid())
  )
  OR
  (
    conversation_id IS NOT NULL
    AND sender_id IS NULL
    AND receiver_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
)
WITH CHECK (
  (
    conversation_id IS NULL
    AND receiver_id = (SELECT auth.uid())
  )
  OR
  (
    conversation_id IS NOT NULL
    AND sender_id IS NULL
    AND receiver_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
);

DROP POLICY IF EXISTS messages_authenticated_delete ON public.messages;
CREATE POLICY messages_authenticated_delete
ON public.messages
FOR DELETE
TO authenticated
USING (
  conversation_id IS NOT NULL
  AND sender_id IS NULL
  AND receiver_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND c.user_id = (SELECT auth.uid())
  )
);

REVOKE UPDATE ON TABLE public.messages FROM authenticated;
GRANT UPDATE (is_read, content, edited, edited_at)
  ON TABLE public.messages TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_message_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.conversation_id IS NULL THEN
      IF NEW.sender_id IS DISTINCT FROM v_uid
         OR NEW.receiver_id IS NULL
         OR NEW.role IS NOT NULL
         OR COALESCE(NEW.edited, false) IS TRUE
         OR NEW.edited_at IS NOT NULL
         OR COALESCE(NEW.is_read, false) IS TRUE THEN
        RAISE EXCEPTION 'Direct-message sender must match the authenticated caller'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSIF NEW.sender_id IS NOT NULL
       OR NEW.receiver_id IS NOT NULL
       OR NEW.role NOT IN ('user', 'assistant')
       OR COALESCE(NEW.edited, false) IS TRUE
       OR NEW.edited_at IS NOT NULL
       OR COALESCE(NEW.is_read, false) IS TRUE THEN
      RAISE EXCEPTION 'Conversation history cannot carry direct-message participant IDs'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.created_at := now();
    NEW.edited := false;
    NEW.edited_at := NULL;
    NEW.is_read := false;

    RETURN NEW;
  END IF;

  IF OLD.conversation_id IS NULL THEN
    IF OLD.receiver_id IS DISTINCT FROM v_uid
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.edited IS DISTINCT FROM OLD.edited
       OR NEW.edited_at IS DISTINCT FROM OLD.edited_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
       OR NEW.is_read IS NOT TRUE THEN
      RAISE EXCEPTION 'A message recipient may only mark the message as read'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
       OR NEW.is_read IS DISTINCT FROM OLD.is_read THEN
      RAISE EXCEPTION 'Conversation message identity fields are immutable'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_message_integrity()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_messages_integrity_guard ON public.messages;
CREATE TRIGGER trg_messages_integrity_guard
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_message_integrity();

-- ---------------------------------------------------------------------------
-- tour_requests: this legacy table has no browser UPDATE consumer. Keep reads
-- and tourist-owned creation, but remove the participant-reassignment surface.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tour_requests_authenticated_update ON public.tour_requests;
REVOKE UPDATE ON TABLE public.tour_requests FROM authenticated;

-- ---------------------------------------------------------------------------
-- trip_requests: provider discovery matches the exact approval/rejection
-- boundary already enforced by validate_trip_slot_insert(). Preserve direct
-- request exclusivity and selected-provider access from the latest workflow.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS trip_requests_authenticated_select ON public.trip_requests;
CREATE POLICY trip_requests_authenticated_select
ON public.trip_requests
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR selected_guide_id = (SELECT auth.uid())
  OR (
    status IN ('active', 'pending', 'open', 'proposals_ready')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('guide', 'agency')
        AND p.is_approved IS TRUE
        AND p.is_rejected IS NOT TRUE
    )
    AND (
      request_channel <> 'direct_profile'
      OR direct_escalated_at IS NOT NULL
      OR direct_provider_id = (SELECT auth.uid())
    )
  )
);

NOTIFY pgrst, 'reload schema';
