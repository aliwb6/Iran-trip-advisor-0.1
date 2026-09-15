-- Trigger-only proposal lifecycle functions must not be callable as public RPCs.
-- PostgreSQL triggers can continue invoking them after EXECUTE is revoked from API roles.

REVOKE ALL ON FUNCTION public.mark_new_trip_proposal_pending_review()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.protect_trip_slot_lifecycle_fields()
  FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
