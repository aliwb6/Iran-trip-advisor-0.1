DROP FUNCTION IF EXISTS public.handle_new_trip_request();

NOTIFY pgrst, 'reload schema';