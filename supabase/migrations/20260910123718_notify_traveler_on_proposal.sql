-- Notify the traveler whenever a guide or travel agency submits a proposal.
-- The proposal that fills the request keeps the existing proposals_ready semantic
-- so downstream consumers receive one useful notification rather than duplicates.

CREATE OR REPLACE FUNCTION public.handle_trip_slot_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_req public.trip_requests%ROWTYPE;
  v_max integer;
  v_dest_text text;
  v_marked_ready boolean := false;
  v_provider_name text;
  v_provider_role text;
  v_sender text;
  v_notification_type text;
  v_notification_message text;
BEGIN
  SELECT * INTO v_req
  FROM public.trip_requests
  WHERE id = NEW.trip_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.trip_slots
  WHERE trip_request_id = NEW.trip_request_id
    AND proposal_round = v_req.proposal_round
    AND status <> 'rejected';

  v_max := COALESCE(v_req.max_proposals, 5);

  UPDATE public.trip_requests
  SET proposals_count = v_count,
      status = CASE
        WHEN v_count >= v_max AND status IN ('active','pending','open') THEN 'proposals_ready'
        ELSE status
      END,
      updated_at = now()
  WHERE id = NEW.trip_request_id
  RETURNING (status = 'proposals_ready' AND v_req.status <> 'proposals_ready')
  INTO v_marked_ready;

  IF v_req.user_id IS NOT NULL THEN
    v_dest_text := COALESCE(NULLIF(array_to_string(v_req.destination, ', '), ''), 'Iran');

    SELECT p.full_name, p.role::text
      INTO v_provider_name, v_provider_role
    FROM public.profiles p
    WHERE p.id = NEW.guide_id;

    IF lower(COALESCE(v_provider_role, '')) = 'agency' THEN
      v_sender := CASE
        WHEN NULLIF(btrim(v_provider_name), '') IS NOT NULL
          THEN 'Travel agency ' || btrim(v_provider_name)
        ELSE 'A travel agency'
      END;
    ELSE
      v_sender := CASE
        WHEN NULLIF(btrim(v_provider_name), '') IS NOT NULL
          THEN 'Guide ' || btrim(v_provider_name)
        ELSE 'A local guide'
      END;
    END IF;

    IF v_marked_ready THEN
      v_notification_type := 'proposals_ready';
      v_notification_message :=
        v_sender || ' sent you a new proposal for your trip to ' || v_dest_text ||
        '. You now have ' || v_count || ' proposals ready to review.';
    ELSE
      v_notification_type := 'proposal_received';
      v_notification_message :=
        v_sender || ' sent you a new proposal for your trip to ' || v_dest_text ||
        '. Tap to review it.';
    END IF;

    INSERT INTO public.notifications (user_id, type, message, related_request_id)
    VALUES (
      v_req.user_id,
      v_notification_type,
      v_notification_message,
      NEW.trip_request_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- The navbar bell already listens for Postgres changes. Publish notifications so
-- logged-in travelers receive the unread badge without needing to refresh.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END;
$$;
