-- Refine the pre-payment contact detector after adversarial/false-positive tests.
-- Disguised email detection now requires an actual TLD marker and phone
-- candidates must contain at least nine digits after separators are removed.

CREATE OR REPLACE FUNCTION private.message_contains_contact_info(p_content text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_text text;
  v_match text[];
BEGIN
  IF p_content IS NULL OR btrim(p_content) = '' THEN
    RETURN false;
  END IF;

  v_text := lower(translate(
    p_content,
    '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
    '01234567890123456789'
  ));

  IF v_text ~ '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}'
     OR v_text ~ '[a-z0-9._%+\-]+[[:space:]]+(at|\(at\)|\[at\])[[:space:]]+[a-z0-9.\-]+(\.[a-z]{2,}|[[:space:]]+(dot|\(dot\)|\[dot\])[[:space:]]+[a-z]{2,})'
     OR v_text ~ '(https?://|www\.)[^[:space:]]+'
     OR v_text ~ '[a-z0-9][a-z0-9.\-]+\.(com|net|org|ir|io|me|co|info|biz|app|travel|tour|site)(/|[[:space:]]|$)'
     OR v_text ~ '(telegram|t\.me/|تلگرام|whatsapp|wa\.me/|واتساپ|واتس[[:space:]]*اپ|instagram|insta([[:space:]]|:)|اینستاگرام|اینستا|signal|سیگنال|viber|وایبر|wechat|ویچت|skype|اسکایپ|messenger)'
     OR v_text ~ '(^|[[:space:][:punct:]])@[a-z0-9_][a-z0-9_.]{2,}' THEN
    RETURN true;
  END IF;

  FOR v_match IN
    SELECT match
    FROM regexp_matches(v_text, '(\+?[0-9][0-9[:space:]().\-]{7,}[0-9])', 'g') AS match
  LOOP
    IF length(regexp_replace(v_match[1], '[^0-9]', '', 'g')) >= 9 THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION private.message_contains_contact_info(text)
  FROM PUBLIC, anon, authenticated;
