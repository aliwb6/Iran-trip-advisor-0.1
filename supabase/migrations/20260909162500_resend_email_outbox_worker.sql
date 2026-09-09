-- Transactional email delivery worker for public.email_outbox using Resend.
-- The Resend API key is stored separately in Supabase Vault under
-- `resend_email_worker_api_key`; no credential is committed to source control.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.email_outbox
  ADD COLUMN IF NOT EXISTS provider_request_id bigint,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_email_outbox_provider_request
  ON public.email_outbox(provider_request_id)
  WHERE provider_request_id IS NOT NULL;

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
  v_subject text;
  v_body text;
  v_destination text;
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
    SELECT COALESCE(string_agg(value, ', '), 'Iran')
      INTO v_destination
    FROM jsonb_array_elements_text(COALESCE(v_row.payload->'destination', '[]'::jsonb));

    IF v_row.template = 'direct_trip_request' THEN
      v_subject := 'New direct trip request on Iran Trip Advisor';
      v_body := 'Hello ' || COALESCE(NULLIF(v_row.payload->>'provider_name', ''), 'Guide') || E',\n\n'
        || 'You have received a direct trip request for ' || v_destination || '. '
        || 'This request is exclusive to you for 12 hours. Submit your proposal before '
        || COALESCE(v_row.payload->>'deadline', 'the deadline') || E'.\n\n'
        || 'Open your requests: https://irantripadvisor.net/dashboard/requests' || E'\n\n'
        || 'Iran Trip Advisor';
    ELSIF v_row.template = 'trip_request_escalation_invite' THEN
      v_subject := 'A trip request is open for your proposal';
      v_body := 'Hello ' || COALESCE(NULLIF(v_row.payload->>'guide_name', ''), 'Guide') || E',\n\n'
        || 'A traveler request for ' || v_destination || ' is now open to selected guides. '
        || 'You can review it and submit a proposal from your dashboard.' || E'\n\n'
        || 'Open your requests: https://irantripadvisor.net/dashboard/requests' || E'\n\n'
        || 'Iran Trip Advisor';
    ELSE
      v_subject := 'Iran Trip Advisor notification';
      v_body := 'You have a new notification from Iran Trip Advisor.' || E'\n\n'
        || 'https://irantripadvisor.net';
    END IF;

    SELECT net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_api_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', 'Iran Trip Advisor <notifications@irantripadvisor.net>',
        'to', jsonb_build_array(v_row.recipient_email),
        'subject', v_subject,
        'text', v_body
      ),
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

CREATE OR REPLACE FUNCTION public.reconcile_email_outbox()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.email_outbox%ROWTYPE;
  v_response record;
  v_reconciled integer := 0;
  v_delay interval;
BEGIN
  FOR v_row IN
    SELECT e.*
    FROM public.email_outbox e
    WHERE e.status = 'sending'
      AND e.provider_request_id IS NOT NULL
    ORDER BY e.last_attempt_at NULLS FIRST
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT r.status_code, r.content, r.error_msg, r.timed_out
      INTO v_response
    FROM net._http_response r
    WHERE r.id = v_row.provider_request_id
    ORDER BY r.created DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_response.status_code BETWEEN 200 AND 299
         AND COALESCE(v_response.timed_out, false) IS FALSE
         AND v_response.error_msg IS NULL THEN
        UPDATE public.email_outbox
        SET status = 'sent',
            sent_at = now(),
            last_error = NULL
        WHERE id = v_row.id;
      ELSE
        v_delay := CASE v_row.attempts
          WHEN 1 THEN interval '1 minute'
          WHEN 2 THEN interval '5 minutes'
          WHEN 3 THEN interval '15 minutes'
          ELSE interval '60 minutes'
        END;

        UPDATE public.email_outbox
        SET status = 'failed',
            available_at = CASE WHEN attempts < 5 THEN now() + v_delay ELSE available_at END,
            last_error = LEFT(COALESCE(v_response.error_msg, v_response.content, 'Resend request failed'), 2000)
        WHERE id = v_row.id;
      END IF;

      v_reconciled := v_reconciled + 1;
    ELSIF v_row.last_attempt_at IS NOT NULL
          AND v_row.last_attempt_at < now() - interval '10 minutes' THEN
      v_delay := CASE v_row.attempts
        WHEN 1 THEN interval '1 minute'
        WHEN 2 THEN interval '5 minutes'
        WHEN 3 THEN interval '15 minutes'
        ELSE interval '60 minutes'
      END;

      UPDATE public.email_outbox
      SET status = 'failed',
          available_at = CASE WHEN attempts < 5 THEN now() + v_delay ELSE available_at END,
          last_error = 'Email provider response timed out'
      WHERE id = v_row.id;

      v_reconciled := v_reconciled + 1;
    END IF;
  END LOOP;

  RETURN v_reconciled;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_email_outbox() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  FOR v_job_id IN
    SELECT jobid FROM cron.job WHERE jobname = 'process-email-outbox'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'process-email-outbox',
  '* * * * *',
  'SELECT public.reconcile_email_outbox(); SELECT public.process_email_outbox(20);'
);

NOTIFY pgrst, 'reload schema';
