-- Allow authenticated message inserts/updates to invoke the private, pure contact detector
-- from the existing SECURITY INVOKER trigger without exposing the detector publicly.
-- The private schema is not exposed through the public PostgREST API.

REVOKE ALL ON FUNCTION private.message_contains_contact_info(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.message_contains_contact_info(text) FROM anon;
GRANT EXECUTE ON FUNCTION private.message_contains_contact_info(text) TO authenticated;
