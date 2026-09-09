-- Phase 4A: add covering indexes for foreign keys reported by Supabase advisor.
-- These are low-risk btree indexes intended to improve joins, deletes/updates on
-- referenced rows, and relationship-scoped RLS/query plans.

CREATE INDEX IF NOT EXISTS idx_guides_user_id
  ON public.guides (user_id);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_id
  ON public.messages (receiver_id);

CREATE INDEX IF NOT EXISTS idx_reviews_agency_id
  ON public.reviews (agency_id)
  WHERE agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_guide_id
  ON public.reviews (guide_id)
  WHERE guide_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_settings_updated_by
  ON public.site_settings (updated_by)
  WHERE updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tour_requests_guide_id
  ON public.tour_requests (guide_id)
  WHERE guide_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tour_requests_tour_id
  ON public.tour_requests (tour_id)
  WHERE tour_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tour_requests_tourist_id
  ON public.tour_requests (tourist_id)
  WHERE tourist_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tours_agency_id
  ON public.tours (agency_id)
  WHERE agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tours_guide_id
  ON public.tours (guide_id)
  WHERE guide_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tours_owner_id
  ON public.tours (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trip_requests_selected_guide_id
  ON public.trip_requests (selected_guide_id)
  WHERE selected_guide_id IS NOT NULL;