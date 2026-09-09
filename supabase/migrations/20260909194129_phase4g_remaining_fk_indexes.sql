-- Phase 4G: cover foreign keys introduced after the initial Phase 4 index pass.

CREATE INDEX IF NOT EXISTS idx_direct_trip_request_intents_provider_id
  ON public.direct_trip_request_intents(provider_id);

CREATE INDEX IF NOT EXISTS idx_email_outbox_recipient_user_id
  ON public.email_outbox(recipient_user_id);
