-- Localized transactional email templates for trip-request notifications.
-- Keeps Resend HTML in Resend Templates and sends only template aliases + variables.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_language_check
  CHECK (preferred_language IN ('en', 'fa', 'ar'));

COMMENT ON COLUMN public.profiles.preferred_language IS
  'Preferred UI/transactional email language: en, fa, or ar.';

CREATE OR REPLACE FUNCTION public.set_preferred_language(language text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_language text := lower(coalesce(language, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_language NOT IN ('en', 'fa', 'ar') THEN
    RAISE EXCEPTION 'Unsupported language';
  END IF;

  UPDATE public.profiles
  SET preferred_language = v_language,
      updated_at = now()
  WHERE id = v_user_id;

  RETURN v_language;
END;
$$;

REVOKE ALL ON FUNCTION public.set_preferred_language(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_preferred_language(text) TO authenticated;

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
  v_processed integer := 0;
BEGIN
  SELECT decrypted_secret
    INTO v_api_key
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
      SELECT COALESCE(p.preferred_language, 'en')
        INTO v_lang
      FROM public.profiles p
      WHERE p.id = v_row.recipient_user_id;
    END IF;
    IF v_lang NOT IN ('en', 'fa', 'ar') THEN
      v_lang := 'en';
    END IF;

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

    SELECT COALESCE(string_agg(value, ', '), 'Iran')
      INTO v_destination
    FROM jsonb_array_elements_text(
      COALESCE(
        to_jsonb(v_trip.destination),
        v_row.payload->'destination',
        '[]'::jsonb
      )
    );

    v_start_date := COALESCE(v_trip.start_date::text, 'Not specified');
    v_end_date := COALESCE(v_trip.end_date::text, 'Not specified');
    v_deadline := COALESCE(
      to_char(v_trip.direct_response_deadline AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC'),
      v_row.payload->>'deadline',
      'Within 12 hours'
    );
    v_cta_url := 'https://irantripadvisor.net/dashboard/requests';

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
        'template', jsonb_build_object(
          'id', v_template_alias,
          'variables', v_variables
        )
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
        'template', jsonb_build_object(
          'id', v_template_alias,
          'variables', v_variables
        )
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

REVOKE ALL ON FUNCTION public.process_email_outbox(integer) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
