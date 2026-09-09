-- Phase 4G: document and enforce browser-deny semantics on internal service-only tables.

DROP POLICY IF EXISTS direct_trip_request_intents_browser_deny ON public.direct_trip_request_intents;
CREATE POLICY direct_trip_request_intents_browser_deny
ON public.direct_trip_request_intents
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS email_outbox_browser_deny ON public.email_outbox;
CREATE POLICY email_outbox_browser_deny
ON public.email_outbox
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
