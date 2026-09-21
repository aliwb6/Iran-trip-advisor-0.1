-- Send administrators an in-app notification for new platform activity.
-- These database triggers run regardless of which client created the record.

CREATE OR REPLACE FUNCTION private.notify_site_administrators(
  p_type text,
  p_message text,
  p_related_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, message, related_user_id)
  SELECT p.id, p_type, p_message, p_related_user_id
  FROM public.profiles AS p
  WHERE p.role = 'admin' OR p.is_admin IS TRUE;
END;
$$;

REVOKE ALL ON FUNCTION private.notify_site_administrators(text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_admin_on_article_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.author_type <> 'admin' THEN
    PERFORM private.notify_site_administrators(
      'admin_article_submitted',
      'A new article was submitted by a ' || COALESCE(NEW.author_type, 'provider') || ': ' || COALESCE(NULLIF(btrim(NEW.title_fa), ''), NULLIF(btrim(NEW.title_en), ''), 'Untitled article') || '.',
      NEW.author_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_on_provider_registered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.role IN ('guide', 'agency') AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM NEW.role) THEN
    PERFORM private.notify_site_administrators(
      'admin_provider_registered',
      'A new ' || NEW.role || ' profile was submitted: ' || COALESCE(NULLIF(btrim(NEW.full_name), ''), 'Unnamed provider') || '.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_on_direct_chat_started()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_sender_name text;
  v_receiver_name text;
BEGIN
  IF NEW.sender_id IS NULL OR NEW.receiver_id IS NULL OR NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.messages AS m
    WHERE m.id <> NEW.id
      AND ((m.sender_id = NEW.sender_id AND m.receiver_id = NEW.receiver_id)
        OR (m.sender_id = NEW.receiver_id AND m.receiver_id = NEW.sender_id))
  ) THEN
    RETURN NEW;
  END IF;
  SELECT NULLIF(btrim(full_name), '') INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  SELECT NULLIF(btrim(full_name), '') INTO v_receiver_name FROM public.profiles WHERE id = NEW.receiver_id;
  PERFORM private.notify_site_administrators(
    'admin_chat_started',
    'A new chat started between ' || COALESCE(v_sender_name, 'a user') || ' and ' || COALESCE(v_receiver_name, 'a user') || '.',
    NEW.sender_id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_on_tour_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.notify_site_administrators('admin_tour_submitted', 'A new tour was submitted: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Untitled tour') || '.', NEW.guide_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_on_trip_request_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.notify_site_administrators('admin_trip_request_created', 'A new trip request was created.', COALESCE(NEW.user_id, NEW.traveler_id));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_on_proposal_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.notify_site_administrators('admin_proposal_submitted', 'A provider submitted a new trip proposal.', NEW.guide_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_on_review_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.notify_site_administrators('admin_review_submitted', 'A new review was submitted for moderation.', NEW.reviewer_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_on_booking_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.notify_site_administrators('admin_booking_created', 'A new booking was created.', NEW.traveler_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_on_article_submitted ON public.articles;
CREATE TRIGGER notify_admin_on_article_submitted AFTER INSERT ON public.articles FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_article_submitted();

DROP TRIGGER IF EXISTS notify_admin_on_provider_registered ON public.profiles;
CREATE TRIGGER notify_admin_on_provider_registered AFTER INSERT OR UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_provider_registered();

DROP TRIGGER IF EXISTS notify_admin_on_direct_chat_started ON public.messages;
CREATE TRIGGER notify_admin_on_direct_chat_started AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_direct_chat_started();

DROP TRIGGER IF EXISTS notify_admin_on_tour_submitted ON public.tours;
CREATE TRIGGER notify_admin_on_tour_submitted AFTER INSERT ON public.tours FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_tour_submitted();

DROP TRIGGER IF EXISTS notify_admin_on_trip_request_created ON public.trip_requests;
CREATE TRIGGER notify_admin_on_trip_request_created AFTER INSERT ON public.trip_requests FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_trip_request_created();

DROP TRIGGER IF EXISTS notify_admin_on_proposal_submitted ON public.trip_slots;
CREATE TRIGGER notify_admin_on_proposal_submitted AFTER INSERT ON public.trip_slots FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_proposal_submitted();

DROP TRIGGER IF EXISTS notify_admin_on_review_submitted ON public.reviews;
CREATE TRIGGER notify_admin_on_review_submitted AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_review_submitted();

DROP TRIGGER IF EXISTS notify_admin_on_booking_created ON public.bookings;
CREATE TRIGGER notify_admin_on_booking_created AFTER INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_booking_created();

REVOKE ALL ON FUNCTION public.notify_admin_on_article_submitted() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_on_provider_registered() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_on_direct_chat_started() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_on_tour_submitted() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_on_trip_request_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_on_proposal_submitted() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_on_review_submitted() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_on_booking_created() FROM PUBLIC, anon, authenticated;
