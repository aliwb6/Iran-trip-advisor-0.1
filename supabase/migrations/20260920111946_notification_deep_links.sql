-- Give direct-message notifications a dedicated participant reference. The
-- existing related_request_id is a foreign key to trip_requests and must remain
-- reserved for request-related notifications.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created_at
  ON public.notifications (user_id, is_read, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_direct_message_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sender_name text;
BEGIN
  -- AI conversation rows and self-addressed rows are not direct messages that
  -- should produce an inbox alert.
  IF NEW.sender_id IS NULL OR NEW.receiver_id IS NULL OR NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(btrim(p.full_name), '')
  INTO v_sender_name
  FROM public.profiles AS p
  WHERE p.id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, message, related_user_id)
  VALUES (
    NEW.receiver_id,
    'message',
    'You have a new message from ' || COALESCE(v_sender_name, 'a traveler or provider') || '.',
    NEW.sender_id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_direct_message_recipient() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_direct_message_recipient ON public.messages;
CREATE TRIGGER notify_direct_message_recipient
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_direct_message_recipient();
