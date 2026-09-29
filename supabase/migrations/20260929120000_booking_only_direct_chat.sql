-- Direct chat is a post-booking capability. Both published package tours and
-- custom tours become bookings only after the traveler selects an
-- admin-approved provider proposal. Off-platform contact release remains a
-- separate payment-gated capability.

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
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.status <> 'cancelled'
        AND (
          (b.tourist_id = (SELECT auth.uid()) AND b.guide_id = p_counterparty_id)
          OR
          (b.guide_id = (SELECT auth.uid()) AND b.tourist_id = p_counterparty_id)
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

NOTIFY pgrst, 'reload schema';
