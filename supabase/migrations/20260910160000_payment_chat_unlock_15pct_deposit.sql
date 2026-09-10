-- Payment/chat lifecycle refinement:
-- 1) use a 15% booking deposit,
-- 2) release direct messaging only after the deposit is securely settled,
-- 3) preserve AI conversation history and admin moderation access.

-- Future bookings snapshot the configured deposit percentage when the selected
-- provider finalizes the booking.
INSERT INTO public.site_settings (key, value, updated_at)
VALUES ('booking_deposit_percentage', '0.15'::jsonb, now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

-- Bring already-created but not actively processing/settled bookings onto the
-- same 15% deposit rule. Never rewrite a booking that has an active or settled
-- provider payment attempt.
UPDATE public.bookings b
SET deposit_percentage = 0.15,
    deposit_amount = round(b.price * 0.15, 2),
    balance_due = b.price - round(b.price * 0.15, 2),
    updated_at = now()
WHERE b.payment_status IN ('unpaid', 'failed')
  AND NOT EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.booking_id = b.id
      AND p.status IN ('pending', 'processing', 'paid', 'refunded')
  );

-- Canonical paid-booking predicate for direct-message authorization. This is
-- SECURITY DEFINER so message RLS can evaluate the booking relationship without
-- creating recursive RLS dependencies. A redirect/query string is never enough:
-- only the server-updated booking state and contact release flag count.
CREATE OR REPLACE FUNCTION private.current_user_has_released_booking(p_counterparty_id uuid)
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
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.contact_released IS TRUE
        AND b.payment_status IN ('deposit_paid', 'paid')
        AND (
          (b.tourist_id = (SELECT auth.uid()) AND b.guide_id = p_counterparty_id)
          OR
          (b.guide_id = (SELECT auth.uid()) AND b.tourist_id = p_counterparty_id)
        )
    );
$$;

REVOKE ALL ON FUNCTION private.current_user_has_released_booking(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_has_released_booking(uuid)
  TO authenticated;

-- Keep the existing helper name used by message INSERT RLS, but make the rule
-- intentionally strict: direct chat is a post-payment capability only.
CREATE OR REPLACE FUNCTION private.current_user_can_message(p_recipient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.current_user_has_released_booking(p_recipient_id);
$$;

REVOKE ALL ON FUNCTION private.current_user_can_message(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_can_message(uuid)
  TO authenticated;

-- Direct-message reads are gated too, so an old or manually crafted chat URL
-- cannot expose a conversation before payment. AI conversation history remains
-- owner-scoped and administrators retain moderation read access.
DROP POLICY IF EXISTS messages_authenticated_select ON public.messages;
CREATE POLICY messages_authenticated_select
ON public.messages
FOR SELECT
TO authenticated
USING (
  public.current_user_is_admin()
  OR (
    conversation_id IS NULL
    AND (
      (
        sender_id = (SELECT auth.uid())
        AND (SELECT private.current_user_has_released_booking(receiver_id))
      )
      OR
      (
        receiver_id = (SELECT auth.uid())
        AND (SELECT private.current_user_has_released_booking(sender_id))
      )
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
    AND (SELECT private.current_user_has_released_booking(sender_id))
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
    AND (SELECT private.current_user_has_released_booking(sender_id))
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

NOTIFY pgrst, 'reload schema';
