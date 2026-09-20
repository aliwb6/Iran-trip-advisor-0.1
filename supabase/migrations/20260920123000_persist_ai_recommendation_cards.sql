-- Preserve the structured tour, guide, and agency recommendations rendered
-- beneath an AI assistant message. Existing RLS on public.messages continues
-- to govern access to this metadata because it remains on the same row.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS cards jsonb;
