-- Administrative moderation state for a direct tourist ↔ guide/agency chat.
-- The participant ids are stored in canonical order so one pair has one state row.

CREATE TABLE IF NOT EXISTS public.direct_chat_moderation (
  participant_one_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_two_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_closed boolean NOT NULL DEFAULT false,
  closure_reason text,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_one_id, participant_two_id),
  CONSTRAINT direct_chat_moderation_distinct_participants CHECK (participant_one_id <> participant_two_id),
  CONSTRAINT direct_chat_moderation_canonical_pair CHECK (participant_one_id < participant_two_id),
  CONSTRAINT direct_chat_moderation_reason_when_closed CHECK (
    (is_closed IS FALSE AND closure_reason IS NULL AND closed_at IS NULL)
    OR (is_closed IS TRUE AND length(btrim(closure_reason)) > 0 AND closed_at IS NOT NULL)
  )
);

ALTER TABLE public.direct_chat_moderation ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_chat_moderation;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

REVOKE ALL ON TABLE public.direct_chat_moderation FROM anon, authenticated;
GRANT SELECT ON TABLE public.direct_chat_moderation TO authenticated;

CREATE POLICY direct_chat_moderation_participant_read
ON public.direct_chat_moderation
FOR SELECT TO authenticated
USING (
  participant_one_id = (SELECT auth.uid())
  OR participant_two_id = (SELECT auth.uid())
  OR private.current_user_is_admin()
);

-- These RPCs keep administrative writes narrowly scoped and auditable.
CREATE OR REPLACE FUNCTION public.close_direct_chat(
  p_participant_a uuid,
  p_participant_b uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_one uuid;
  v_two uuid;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required';
  END IF;
  IF p_participant_a IS NULL OR p_participant_b IS NULL OR p_participant_a = p_participant_b THEN
    RAISE EXCEPTION 'Two distinct chat participants are required';
  END IF;
  IF v_reason = '' THEN
    RAISE EXCEPTION 'A closure reason is required';
  END IF;

  v_one := LEAST(p_participant_a, p_participant_b);
  v_two := GREATEST(p_participant_a, p_participant_b);
  INSERT INTO public.direct_chat_moderation (
    participant_one_id, participant_two_id, is_closed, closure_reason, closed_at, closed_by, updated_at
  ) VALUES (v_one, v_two, true, v_reason, now(), auth.uid(), now())
  ON CONFLICT (participant_one_id, participant_two_id) DO UPDATE
  SET is_closed = true,
      closure_reason = EXCLUDED.closure_reason,
      closed_at = EXCLUDED.closed_at,
      closed_by = EXCLUDED.closed_by,
      updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_direct_chat(
  p_participant_a uuid,
  p_participant_b uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_one uuid;
  v_two uuid;
BEGIN
  IF NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required';
  END IF;
  IF p_participant_a IS NULL OR p_participant_b IS NULL OR p_participant_a = p_participant_b THEN
    RAISE EXCEPTION 'Two distinct chat participants are required';
  END IF;
  v_one := LEAST(p_participant_a, p_participant_b);
  v_two := GREATEST(p_participant_a, p_participant_b);
  UPDATE public.direct_chat_moderation
  SET is_closed = false,
      closure_reason = NULL,
      closed_at = NULL,
      closed_by = NULL,
      updated_at = now()
  WHERE participant_one_id = v_one AND participant_two_id = v_two;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_edit_direct_message(
  p_message_id uuid,
  p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_content text := btrim(COALESCE(p_content, ''));
BEGIN
  IF NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Administrator access is required';
  END IF;
  IF v_content = '' THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;
  UPDATE public.messages
  SET content = v_content,
      edited = true,
      edited_at = now()
  WHERE id = p_message_id
    AND sender_id IS NOT NULL
    AND receiver_id IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Direct message not found';
  END IF;
END;
$$;

-- A closed chat must remain closed even if a participant has an older browser tab.
CREATE OR REPLACE FUNCTION public.prevent_closed_direct_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_one uuid;
  v_two uuid;
BEGIN
  IF NEW.sender_id IS NULL OR NEW.receiver_id IS NULL THEN
    RETURN NEW;
  END IF;
  v_one := LEAST(NEW.sender_id, NEW.receiver_id);
  v_two := GREATEST(NEW.sender_id, NEW.receiver_id);
  IF EXISTS (
    SELECT 1
    FROM public.direct_chat_moderation
    WHERE participant_one_id = v_one
      AND participant_two_id = v_two
      AND is_closed
  ) THEN
    RAISE EXCEPTION 'This conversation was closed by an administrator.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_closed_direct_chat_message ON public.messages;
CREATE TRIGGER prevent_closed_direct_chat_message
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.prevent_closed_direct_chat_message();

REVOKE ALL ON FUNCTION public.close_direct_chat(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reopen_direct_chat(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_edit_direct_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_direct_chat(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_direct_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_edit_direct_message(uuid, text) TO authenticated;
