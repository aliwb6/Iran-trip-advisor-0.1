-- Marketplace communication lifecycle:
-- 1) allow direct chat once a real request/proposal relationship exists,
-- 2) keep off-platform contact sharing blocked before verified payment,
-- 3) release provider contact methods only after the booking contact-release flag
--    has been set by the verified payment lifecycle.

-- ---------------------------------------------------------------------------
-- Provider-owned private contact methods. Canonical phone/email continue to
-- live on profiles; this table stores optional off-platform channels only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_contact_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  value text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_contact_methods_type_check
    CHECK (type IN ('whatsapp', 'telegram', 'instagram', 'website', 'other')),
  CONSTRAINT provider_contact_methods_value_check
    CHECK (length(btrim(value)) BETWEEN 1 AND 500),
  CONSTRAINT provider_contact_methods_provider_type_unique
    UNIQUE (provider_id, type)
);

CREATE INDEX IF NOT EXISTS idx_provider_contact_methods_provider_id
  ON public.provider_contact_methods(provider_id);

ALTER TABLE public.provider_contact_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_contact_methods_owner_select ON public.provider_contact_methods;
CREATE POLICY provider_contact_methods_owner_select
ON public.provider_contact_methods
FOR SELECT
TO authenticated
USING (
  provider_id = (SELECT auth.uid())
  OR (SELECT private.current_user_is_admin())
);

DROP POLICY IF EXISTS provider_contact_methods_owner_insert ON public.provider_contact_methods;
CREATE POLICY provider_contact_methods_owner_insert
ON public.provider_contact_methods
FOR INSERT
TO authenticated
WITH CHECK (
  (
    provider_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('guide', 'agency')
    )
  )
  OR (SELECT private.current_user_is_admin())
);

DROP POLICY IF EXISTS provider_contact_methods_owner_update ON public.provider_contact_methods;
CREATE POLICY provider_contact_methods_owner_update
ON public.provider_contact_methods
FOR UPDATE
TO authenticated
USING (
  provider_id = (SELECT auth.uid())
  OR (SELECT private.current_user_is_admin())
)
WITH CHECK (
  (
    provider_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('guide', 'agency')
    )
  )
  OR (SELECT private.current_user_is_admin())
);

DROP POLICY IF EXISTS provider_contact_methods_owner_delete ON public.provider_contact_methods;
CREATE POLICY provider_contact_methods_owner_delete
ON public.provider_contact_methods
FOR DELETE
TO authenticated
USING (
  provider_id = (SELECT auth.uid())
  OR (SELECT private.current_user_is_admin())
);

REVOKE ALL ON TABLE public.provider_contact_methods FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_contact_methods TO authenticated;

-- ---------------------------------------------------------------------------
-- Chat authorization is relationship-based, not payment-based.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.current_user_has_chat_relationship(p_counterparty_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND p_counterparty_id IS NOT NULL
    AND p_counterparty_id <> (SELECT auth.uid())
    AND (
      -- A selected proposal creates a booking before payment. That relationship
      -- is sufficient for chat; contact release remains a separate capability.
      EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.status <> 'cancelled'
          AND (
            (b.tourist_id = (SELECT auth.uid()) AND b.guide_id = p_counterparty_id)
            OR
            (b.guide_id = (SELECT auth.uid()) AND b.tourist_id = p_counterparty_id)
          )
      )
      OR
      -- Package/tour request between a traveler and the package provider.
      EXISTS (
        SELECT 1
        FROM public.tour_requests trq
        WHERE trq.status NOT IN ('rejected', 'cancelled', 'expired')
          AND (
            (trq.tourist_id = (SELECT auth.uid()) AND trq.guide_id = p_counterparty_id)
            OR
            (trq.guide_id = (SELECT auth.uid()) AND trq.tourist_id = p_counterparty_id)
          )
      )
      OR
      -- Custom/direct trip request. Directly invited providers may chat as soon
      -- as the request exists; marketplace providers gain chat after proposing.
      EXISTS (
        SELECT 1
        FROM public.trip_requests tr
        WHERE tr.status NOT IN ('cancelled', 'expired', 'closed')
          AND (
            (
              tr.user_id = (SELECT auth.uid())
              AND (
                tr.selected_guide_id = p_counterparty_id
                OR tr.direct_provider_id = p_counterparty_id
                OR EXISTS (
                  SELECT 1
                  FROM public.trip_slots s
                  WHERE s.trip_request_id = tr.id
                    AND s.guide_id = p_counterparty_id
                    AND COALESCE(s.status, '') NOT IN ('rejected', 'closed')
                )
              )
            )
            OR
            (
              tr.user_id = p_counterparty_id
              AND (
                tr.selected_guide_id = (SELECT auth.uid())
                OR tr.direct_provider_id = (SELECT auth.uid())
                OR EXISTS (
                  SELECT 1
                  FROM public.trip_slots s
                  WHERE s.trip_request_id = tr.id
                    AND s.guide_id = (SELECT auth.uid())
                    AND COALESCE(s.status, '') NOT IN ('rejected', 'closed')
                )
              )
            )
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION private.current_user_has_chat_relationship(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_has_chat_relationship(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.can_chat_with_user(p_counterparty_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.current_user_has_chat_relationship(p_counterparty_id);
$$;

REVOKE ALL ON FUNCTION public.can_chat_with_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_chat_with_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_share_contact_with_user(p_counterparty_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.current_user_has_released_booking(p_counterparty_id);
$$;

REVOKE ALL ON FUNCTION public.can_share_contact_with_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_share_contact_with_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.current_user_can_message(p_recipient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.current_user_has_chat_relationship(p_recipient_id);
$$;

REVOKE ALL ON FUNCTION private.current_user_can_message(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_can_message(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Server-side off-platform contact detection. Browser validation is only UX;
-- this function is the authoritative enforcement against direct API bypasses.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.message_contains_contact_info(p_content text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_text text;
BEGIN
  IF p_content IS NULL OR btrim(p_content) = '' THEN
    RETURN false;
  END IF;

  v_text := lower(translate(
    p_content,
    '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
    '01234567890123456789'
  ));

  RETURN
    -- Email addresses.
    v_text ~ '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}'
    -- Common disguised email syntax such as "name at domain dot com".
    OR v_text ~ '[a-z0-9._%+\-]+[[:space:]]+(at|\(at\)|\[at\])[[:space:]]+[a-z0-9.\-]+([[:space:]]+(dot|\(dot\)|\[dot\])[[:space:]]+[a-z]{2,})?'
    -- Web URLs and common domain forms.
    OR v_text ~ '(https?://|www\.)[^[:space:]]+'
    OR v_text ~ '[a-z0-9][a-z0-9.\-]+\.(com|net|org|ir|io|me|co|info|biz|app|travel|tour|site)(/|[[:space:]]|$)'
    -- Phone-like sequences with separators; require enough total structure to
    -- avoid blocking normal prices, years and short itinerary numbers.
    OR v_text ~ '(^|[^0-9])\+?[0-9][0-9[:space:]().\-]{7,}[0-9]([^0-9]|$)'
    -- Social/contact services and their common short links, English + Persian.
    OR v_text ~ '(telegram|t\.me/|تلگرام|whatsapp|wa\.me/|واتساپ|واتس[[:space:]]*اپ|instagram|insta([[:space:]]|:)|اینستاگرام|اینستا|signal|سیگنال|viber|وایبر|wechat|ویچت|skype|اسکایپ|messenger)'
    -- Social handles. Emails are already covered above; standalone @handles are
    -- prohibited before contact release too.
    OR v_text ~ '(^|[[:space:][:punct:]])@[a-z0-9_][a-z0-9_.]{2,}';
END;
$$;

REVOKE ALL ON FUNCTION private.message_contains_contact_info(text)
  FROM PUBLIC, anon, authenticated;

-- Direct-message reads are participant-scoped, independent of payment. AI
-- conversation history remains owner-scoped and administrators retain read-only
-- moderation visibility.
DROP POLICY IF EXISTS messages_authenticated_select ON public.messages;
CREATE POLICY messages_authenticated_select
ON public.messages
FOR SELECT
TO authenticated
USING (
  (SELECT private.current_user_is_admin())
  OR (
    conversation_id IS NULL
    AND (
      sender_id = (SELECT auth.uid())
      OR receiver_id = (SELECT auth.uid())
    )
  )
  OR (
    conversation_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
);

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
  OR (
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
  OR (
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
  OR (
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

-- Preserve the existing row-integrity contract and add the pre-payment contact
-- sharing guard to direct-message inserts.
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

      IF NOT private.current_user_has_released_booking(NEW.receiver_id)
         AND private.message_contains_contact_info(NEW.content) THEN
        RAISE EXCEPTION 'Contact information can only be shared after booking payment is confirmed'
          USING ERRCODE = 'check_violation';
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

-- ---------------------------------------------------------------------------
-- Secure booking contact surface. It exposes the counterpart's phone/email and,
-- for providers, enabled optional contact methods only after verified payment.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_booking_contact_methods(p_booking_id uuid)
RETURNS TABLE (
  profile_id uuid,
  full_name text,
  contact_type text,
  label text,
  value text,
  display_order integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_target uuid;
  v_is_admin boolean := false;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_is_admin := COALESCE((SELECT private.current_user_is_admin()), false);

  SELECT * INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT v_is_admin
     AND (SELECT auth.uid()) NOT IN (v_booking.tourist_id, v_booking.guide_id) THEN
    RAISE EXCEPTION 'Not authorized to view booking contacts';
  END IF;

  IF NOT v_is_admin
     AND (
       v_booking.contact_released IS NOT TRUE
       OR v_booking.payment_status NOT IN ('deposit_paid', 'paid')
     ) THEN
    RETURN;
  END IF;

  IF v_is_admin THEN
    v_target := v_booking.guide_id;
  ELSIF (SELECT auth.uid()) = v_booking.tourist_id THEN
    v_target := v_booking.guide_id;
  ELSE
    v_target := v_booking.tourist_id;
  END IF;

  RETURN QUERY
  WITH target AS (
    SELECT p.id, p.full_name, p.role, p.email,
           COALESCE(NULLIF(btrim(p.phone_number), ''), NULLIF(btrim(p.phone), '')) AS phone
    FROM public.profiles p
    WHERE p.id = v_target
  ), contacts AS (
    SELECT t.id AS profile_id, t.full_name,
           'phone'::text AS contact_type, 'Phone'::text AS label,
           t.phone AS value, 10 AS display_order
    FROM target t
    WHERE t.phone IS NOT NULL

    UNION ALL

    SELECT t.id, t.full_name,
           'email'::text, 'Email'::text,
           t.email, 20
    FROM target t
    WHERE NULLIF(btrim(t.email), '') IS NOT NULL

    UNION ALL

    SELECT t.id, t.full_name,
           pcm.type,
           CASE pcm.type
             WHEN 'whatsapp' THEN 'WhatsApp'
             WHEN 'telegram' THEN 'Telegram'
             WHEN 'instagram' THEN 'Instagram'
             WHEN 'website' THEN 'Website'
             ELSE 'Other'
           END,
           pcm.value,
           100 + pcm.display_order
    FROM target t
    JOIN public.provider_contact_methods pcm ON pcm.provider_id = t.id
    WHERE t.role IN ('guide', 'agency')
      AND pcm.is_enabled IS TRUE
  )
  SELECT c.profile_id, c.full_name, c.contact_type, c.label, c.value, c.display_order
  FROM contacts c
  ORDER BY c.display_order, c.contact_type;
END;
$$;

REVOKE ALL ON FUNCTION public.get_booking_contact_methods(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_contact_methods(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
