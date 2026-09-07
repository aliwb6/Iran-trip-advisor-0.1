REVOKE ALL ON FUNCTION public.complete_trip_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_trip_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_trip_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_trip_request(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';