-- Admin chat moderation + stronger pre-payment contact-sharing enforcement.
-- Direct-message moderation is keyed by a canonical (sorted) participant pair.

CREATE TABLE IF NOT EXISTS public.chat_moderation_threads (
  participant_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_closed boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  close_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_a, participant_b),
  CONSTRAINT chat_moderation_threads_distinct CHECK (participant_a <> participant_b),
  CONSTRAINT chat_moderation_threads_canonical CHECK (participant_a::text < participant_b::text),
  CONSTRAINT chat_moderation_threads_closed_state CHECK (
    (is_closed AND closed_at IS NOT NULL) OR (NOT is_closed AND closed_at IS NULL)
  ),
  CONSTRAINT chat_moderation_threads_reason_length
    CHECK (close_reason IS NULL OR length(close_reason) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_chat_moderation_threads_closed
  ON public.chat_moderation_threads(is_closed) WHERE is_closed;

ALTER TABLE public.chat_moderation_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_moderation_threads_select ON public.chat_moderation_threads;
CREATE POLICY chat_moderation_threads_select
ON public.chat_moderation_threads FOR SELECT TO authenticated
USING (
  (SELECT private.current_user_is_admin())
  OR participant_a = (SELECT auth.uid())
  OR participant_b = (SELECT auth.uid())
);
REVOKE ALL ON TABLE public.chat_moderation_threads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.chat_moderation_threads TO authenticated;

CREATE TABLE IF NOT EXISTS public.chat_moderation_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason_code text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_moderation_warnings_distinct CHECK (participant_a <> participant_b),
  CONSTRAINT chat_moderation_warnings_canonical CHECK (participant_a::text < participant_b::text),
  CONSTRAINT chat_moderation_warnings_target CHECK (
    target_user_id IS NULL OR target_user_id = participant_a OR target_user_id = participant_b
  ),
  CONSTRAINT chat_moderation_warnings_reason CHECK (
    reason_code IN ('contact_sharing', 'off_platform_payment', 'abusive_content', 'spam', 'other')
  ),
  CONSTRAINT chat_moderation_warnings_message_length
    CHECK (length(btrim(message)) BETWEEN 1 AND 1500)
);

CREATE INDEX IF NOT EXISTS idx_chat_moderation_warnings_pair_created
  ON public.chat_moderation_warnings(participant_a, participant_b, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_moderation_warnings_target_created
  ON public.chat_moderation_warnings(target_user_id, created_at DESC);

ALTER TABLE public.chat_moderation_warnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_moderation_warnings_select ON public.chat_moderation_warnings;
CREATE POLICY chat_moderation_warnings_select
ON public.chat_moderation_warnings FOR SELECT TO authenticated
USING (
  (SELECT private.current_user_is_admin())
  OR (
    (participant_a = (SELECT auth.uid()) OR participant_b = (SELECT auth.uid()))
    AND (target_user_id IS NULL OR target_user_id = (SELECT auth.uid()))
  )
);
REVOKE ALL ON TABLE public.chat_moderation_warnings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.chat_moderation_warnings TO authenticated;

CREATE TABLE IF NOT EXISTS public.chat_moderation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action text NOT NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_moderation_audit_distinct CHECK (participant_a <> participant_b),
  CONSTRAINT chat_moderation_audit_canonical CHECK (participant_a::text < participant_b::text),
  CONSTRAINT chat_moderation_audit_action CHECK (
    action IN ('message_edit', 'warning', 'chat_close', 'chat_reopen')
  ),
  CONSTRAINT chat_moderation_audit_reason_length
    CHECK (reason IS NULL OR length(reason) <= 1500)
);

CREATE INDEX IF NOT EXISTS idx_chat_moderation_audit_pair_created
  ON public.chat_moderation_audit(participant_a, participant_b, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_moderation_audit_message
  ON public.chat_moderation_audit(message_id) WHERE message_id IS NOT NULL;

ALTER TABLE public.chat_moderation_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_moderation_audit_admin_select ON public.chat_moderation_audit;
CREATE POLICY chat_moderation_audit_admin_select
ON public.chat_moderation_audit FOR SELECT TO authenticated
USING ((SELECT private.current_user_is_admin()));
REVOKE ALL ON TABLE public.chat_moderation_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.chat_moderation_audit TO authenticated;

-- Let already-open chat screens receive close/reopen and warning events.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_moderation_threads;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END;
$$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_moderation_warnings;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END;
$$;

-- Closed-chat enforcement. Existing history stays readable; new direct-message
-- inserts are rejected by the existing messages INSERT policy because it calls
-- private.current_user_can_message().
CREATE OR REPLACE FUNCTION private.chat_pair_is_closed(p_user_a uuid, p_user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT c.is_closed
    FROM public.chat_moderation_threads c
    WHERE c.participant_a = CASE WHEN p_user_a::text < p_user_b::text THEN p_user_a ELSE p_user_b END
      AND c.participant_b = CASE WHEN p_user_a::text < p_user_b::text THEN p_user_b ELSE p_user_a END
    LIMIT 1
  ), false);
$$;
REVOKE ALL ON FUNCTION private.chat_pair_is_closed(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.chat_pair_is_closed(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.current_user_can_message(p_recipient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.current_user_has_chat_relationship(p_recipient_id)
    AND NOT private.chat_pair_is_closed((SELECT auth.uid()), p_recipient_id);
$$;
REVOKE ALL ON FUNCTION private.current_user_can_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_can_message(uuid) TO authenticated;

-- Admin-only mutations. Direct table writes stay revoked from authenticated users.
CREATE OR REPLACE FUNCTION public.admin_set_chat_closed(
  p_user_a uuid,
  p_user_b uuid,
  p_closed boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin uuid := (SELECT auth.uid());
  v_a uuid;
  v_b uuid;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_closed_at timestamptz := CASE WHEN p_closed THEN now() ELSE NULL END;
BEGIN
  IF NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_user_a IS NULL OR p_user_b IS NULL OR p_user_a = p_user_b THEN
    RAISE EXCEPTION 'Invalid chat participants' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_reason IS NOT NULL AND length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'Reason is too long' USING ERRCODE = 'string_data_right_truncation';
  END IF;

  v_a := CASE WHEN p_user_a::text < p_user_b::text THEN p_user_a ELSE p_user_b END;
  v_b := CASE WHEN p_user_a::text < p_user_b::text THEN p_user_b ELSE p_user_a END;

  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.conversation_id IS NULL
      AND ((m.sender_id = v_a AND m.receiver_id = v_b) OR (m.sender_id = v_b AND m.receiver_id = v_a))
  ) THEN
    RAISE EXCEPTION 'Direct-message thread not found' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.chat_moderation_threads (
    participant_a, participant_b, is_closed, closed_at, closed_by, close_reason, updated_at
  ) VALUES (
    v_a, v_b, p_closed, v_closed_at,
    CASE WHEN p_closed THEN v_admin ELSE NULL END,
    CASE WHEN p_closed THEN v_reason ELSE NULL END,
    now()
  )
  ON CONFLICT (participant_a, participant_b) DO UPDATE SET
    is_closed = EXCLUDED.is_closed,
    closed_at = EXCLUDED.closed_at,
    closed_by = EXCLUDED.closed_by,
    close_reason = EXCLUDED.close_reason,
    updated_at = now();

  INSERT INTO public.chat_moderation_audit (
    participant_a, participant_b, admin_id, action, reason, metadata
  ) VALUES (
    v_a, v_b, v_admin,
    CASE WHEN p_closed THEN 'chat_close' ELSE 'chat_reopen' END,
    v_reason,
    jsonb_build_object('is_closed', p_closed)
  );

  RETURN jsonb_build_object(
    'is_closed', p_closed,
    'closed_at', v_closed_at,
    'close_reason', CASE WHEN p_closed THEN v_reason ELSE NULL END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_chat_closed(uuid, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_chat_closed(uuid, uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_warn_chat_user(
  p_user_a uuid,
  p_user_b uuid,
  p_target_user_id uuid,
  p_reason_code text,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin uuid := (SELECT auth.uid());
  v_a uuid;
  v_b uuid;
  v_message text := btrim(COALESCE(p_message, ''));
  v_warning_id uuid;
BEGIN
  IF NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_user_a IS NULL OR p_user_b IS NULL OR p_user_a = p_user_b THEN
    RAISE EXCEPTION 'Invalid chat participants' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_reason_code NOT IN ('contact_sharing', 'off_platform_payment', 'abusive_content', 'spam', 'other') THEN
    RAISE EXCEPTION 'Invalid warning reason' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF length(v_message) < 1 OR length(v_message) > 1500 THEN
    RAISE EXCEPTION 'Warning message must be between 1 and 1500 characters' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_a := CASE WHEN p_user_a::text < p_user_b::text THEN p_user_a ELSE p_user_b END;
  v_b := CASE WHEN p_user_a::text < p_user_b::text THEN p_user_b ELSE p_user_a END;

  IF p_target_user_id IS NOT NULL AND p_target_user_id <> v_a AND p_target_user_id <> v_b THEN
    RAISE EXCEPTION 'Warning target must be a chat participant' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.conversation_id IS NULL
      AND ((m.sender_id = v_a AND m.receiver_id = v_b) OR (m.sender_id = v_b AND m.receiver_id = v_a))
  ) THEN
    RAISE EXCEPTION 'Direct-message thread not found' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.chat_moderation_warnings (
    participant_a, participant_b, target_user_id, admin_id, reason_code, message
  ) VALUES (v_a, v_b, p_target_user_id, v_admin, p_reason_code, v_message)
  RETURNING id INTO v_warning_id;

  INSERT INTO public.chat_moderation_audit (
    participant_a, participant_b, admin_id, action, target_user_id, reason, metadata
  ) VALUES (
    v_a, v_b, v_admin, 'warning', p_target_user_id, v_message,
    jsonb_build_object('reason_code', p_reason_code, 'warning_id', v_warning_id)
  );

  -- Copy the warning to the normal notification inbox when that legacy schema
  -- supports it. Notification failure must not roll back the moderation action.
  IF to_regclass('public.notifications') IS NOT NULL THEN
    IF p_target_user_id IS NULL THEN
      BEGIN
        EXECUTE 'INSERT INTO public.notifications (user_id, type, message, is_read) VALUES ($1, $2, $3, false), ($4, $2, $3, false)'
          USING v_a, 'info', 'Iran Trip Advisor warning: ' || v_message, v_b;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    ELSE
      BEGIN
        EXECUTE 'INSERT INTO public.notifications (user_id, type, message, is_read) VALUES ($1, $2, $3, false)'
          USING p_target_user_id, 'info', 'Iran Trip Advisor warning: ' || v_message;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  RETURN v_warning_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_warn_chat_user(uuid, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_warn_chat_user(uuid, uuid, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_edit_chat_message(
  p_message_id uuid,
  p_new_content text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin uuid := (SELECT auth.uid());
  v_message public.messages%ROWTYPE;
  v_content text := btrim(COALESCE(p_new_content, ''));
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_a uuid;
  v_b uuid;
  v_edited_at timestamptz := now();
BEGIN
  IF NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_message_id IS NULL THEN
    RAISE EXCEPTION 'Message id is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF length(v_content) < 1 OR length(v_content) > 4000 THEN
    RAISE EXCEPTION 'Message must be between 1 and 4000 characters' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_reason IS NOT NULL AND length(v_reason) > 1500 THEN
    RAISE EXCEPTION 'Reason is too long' USING ERRCODE = 'string_data_right_truncation';
  END IF;

  SELECT * INTO v_message
  FROM public.messages m
  WHERE m.id = p_message_id
    AND m.conversation_id IS NULL
    AND m.sender_id IS NOT NULL
    AND m.receiver_id IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Direct message not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_content = v_message.content THEN
    RAISE EXCEPTION 'Edited message is unchanged' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_a := CASE WHEN v_message.sender_id::text < v_message.receiver_id::text THEN v_message.sender_id ELSE v_message.receiver_id END;
  v_b := CASE WHEN v_message.sender_id::text < v_message.receiver_id::text THEN v_message.receiver_id ELSE v_message.sender_id END;

  UPDATE public.messages
  SET content = v_content, edited = true, edited_at = v_edited_at
  WHERE id = p_message_id;

  INSERT INTO public.chat_moderation_audit (
    participant_a, participant_b, admin_id, action,
    message_id, target_user_id, reason, metadata
  ) VALUES (
    v_a, v_b, v_admin, 'message_edit', p_message_id, v_message.sender_id, v_reason,
    jsonb_build_object(
      'original_content', v_message.content,
      'edited_content', v_content,
      'original_edited', COALESCE(v_message.edited, false),
      'original_edited_at', v_message.edited_at
    )
  );

  RETURN jsonb_build_object(
    'id', p_message_id,
    'content', v_content,
    'edited', true,
    'edited_at', v_edited_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_edit_chat_message(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_edit_chat_message(uuid, text, text) TO authenticated;

-- Authoritative pre-payment contact detector. Browser validation mirrors this
-- for instant feedback, but this function protects direct API inserts too.
CREATE OR REPLACE FUNCTION private.message_contains_contact_info(p_content text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_text text;
  v_phone_text text;
  v_match text[];
  v_word text;
  v_digits text;
BEGIN
  IF p_content IS NULL OR btrim(p_content) = '' THEN RETURN false; END IF;

  v_text := lower(translate(
    normalize(p_content, NFKC),
    '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
    '01234567890123456789'
  ));

  IF v_text ~ '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}'
     OR v_text ~ '[a-z0-9._%+\-]+[[:space:]]+(at|\(at\)|\[at\])[[:space:]]+[a-z0-9.\-]+(\.[a-z]{2,}|[[:space:]]+(dot|\(dot\)|\[dot\])[[:space:]]+[a-z]{2,})'
     OR v_text ~ '(https?://|www\.)[^[:space:]]+'
     OR v_text ~ '[a-z0-9][a-z0-9.\-]+\.(com|net|org|ir|io|me|co|info|biz|app|travel|tour|site)(/|[[:space:]]|$)'
     OR v_text ~ '(telegram|t\.me/?|تلگرام|whatsapp|wa\.me/?|واتساپ|واتس[[:space:]]*اپ|instagram|insta([[:space:]]|:)|اینستاگرام|اینستا|signal|سیگنال|viber|وایبر|wechat|ویچت|skype|اسکایپ|messenger)'
     OR v_text ~ '(^|[[:space:][:punct:]])@[a-z0-9_][a-z0-9_.]{2,}'
     OR v_text ~ '(^|[^a-z0-9])t[[:space:]._\-]*e[[:space:]._\-]*l[[:space:]._\-]*e[[:space:]._\-]*g[[:space:]._\-]*r[[:space:]._\-]*a[[:space:]._\-]*m([^a-z0-9]|$)'
     OR v_text ~ '(^|[^a-z0-9])w[[:space:]._\-]*h[[:space:]._\-]*a[[:space:]._\-]*t[[:space:]._\-]*s[[:space:]._\-]*a[[:space:]._\-]*p[[:space:]._\-]*p([^a-z0-9]|$)'
     OR v_text ~ '(^|[^a-z0-9])i[[:space:]._\-]*n[[:space:]._\-]*s[[:space:]._\-]*t[[:space:]._\-]*a[[:space:]._\-]*g[[:space:]._\-]*r[[:space:]._\-]*a[[:space:]._\-]*m([^a-z0-9]|$)'
     OR v_text ~ '(^|[[:space:]])(ig|tg|wa)[[:space:]]*(id|user(name)?|handle|@|:|=)'
     OR v_text ~ '(username|user[[:space:]]*name|handle|my[[:space:]]+id|my[[:space:]]+user(name)?|آیدی|ايدي|شناسه)[[:space:]:=_\-]+([a-z0-9_][[:space:]._\-]*){4,}' THEN
    RETURN true;
  END IF;

  -- Aggressive conversion is isolated to a phone-candidate copy. Ordinary text
  -- between quantities still breaks a candidate, avoiding itinerary false positives.
  v_phone_text := v_text;
  FOR v_word, v_digits IN
    SELECT word, digits FROM (VALUES
      ('nineteen','19'), ('eighteen','18'), ('seventeen','17'), ('sixteen','16'),
      ('fifteen','15'), ('fourteen','14'), ('thirteen','13'), ('twelve','12'),
      ('eleven','11'), ('ten','10'),
      ('zero','0'), ('ziro','0'), ('oh','0'), ('one','1'), ('two','2'),
      ('three','3'), ('four','4'), ('five','5'), ('six','6'), ('seven','7'),
      ('eight','8'), ('nine','9'),
      ('صفر','0'), ('یک','1'), ('يك','1'), ('واحد','1'),
      ('دو','2'), ('اثنان','2'), ('اثنين','2'), ('اتنين','2'),
      ('سه','3'), ('ثلاثة','3'), ('ثلاثه','3'),
      ('چهار','4'), ('أربعة','4'), ('اربعة','4'), ('اربعه','4'),
      ('پنج','5'), ('خمسة','5'), ('خمسه','5'),
      ('شش','6'), ('ستة','6'), ('سته','6'),
      ('هفت','7'), ('سبعة','7'), ('سبعه','7'),
      ('هشت','8'), ('ثمانية','8'), ('ثمانيه','8'),
      ('نه','9'), ('تسعة','9'), ('تسعه','9')
    ) AS words(word, digits)
  LOOP
    IF length(v_digits) = 1 THEN
      v_phone_text := regexp_replace(
        v_phone_text,
        '\mtriple[[:space:]._\-]*' || v_word || '\M',
        repeat(v_digits, 3),
        'gi'
      );
      v_phone_text := regexp_replace(
        v_phone_text,
        '\mdouble[[:space:]._\-]*' || v_word || '\M',
        repeat(v_digits, 2),
        'gi'
      );
    END IF;
    -- Also catches concatenated forms such as zeroeightnine...
    v_phone_text := replace(v_phone_text, v_word, v_digits);
  END LOOP;

  FOR v_match IN
    SELECT match
    FROM regexp_matches(
      v_phone_text,
      '(^|[^[:alnum:]_])(\+?[0-9][0-9[:space:]().\-]{7,}[0-9])([^[:alnum:]_]|$)',
      'g'
    ) AS match
  LOOP
    IF length(regexp_replace(v_match[2], '[^0-9]', '', 'g')) >= 9 THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION private.message_contains_contact_info(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.message_contains_contact_info(text) TO authenticated;
