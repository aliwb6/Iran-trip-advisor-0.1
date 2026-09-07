-- Phase 3A privacy primitives.
-- This migration is additive: it creates safe replacements before broad profile
-- SELECT policies are removed in the final privacy-lockdown migration.

-- Stable admin predicate for RLS/RPC authorization. Browser roles do not need
-- direct EXECUTE permission; policies and SECURITY DEFINER functions may use it.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND (p.role = 'admin' OR p.is_admin IS TRUE)
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC, anon, authenticated;

-- Safe authenticated participant directory. It intentionally returns no email,
-- phone, license or moderation fields. A requested profile is visible only when
-- the caller has a real application relationship with that profile.
CREATE OR REPLACE FUNCTION public.get_participant_profiles(profile_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  gender text,
  role text,
  city text,
  bio text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH caller AS (
    SELECT
      (SELECT auth.uid()) AS uid,
      EXISTS (
        SELECT 1
        FROM public.profiles me
        WHERE me.id = (SELECT auth.uid())
          AND me.role IN ('guide','agency')
          AND me.is_approved IS TRUE
          AND me.is_rejected IS NOT TRUE
      ) AS is_eligible_provider,
      public.current_user_is_admin() AS is_admin
  )
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    p.gender,
    p.role,
    p.city,
    p.bio
  FROM public.profiles p
  CROSS JOIN caller c
  WHERE c.uid IS NOT NULL
    AND p.id = ANY(COALESCE(profile_ids, ARRAY[]::uuid[]))
    AND (
      p.id = c.uid
      OR c.is_admin
      OR EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE (m.sender_id = c.uid AND m.receiver_id = p.id)
           OR (m.sender_id = p.id AND m.receiver_id = c.uid)
      )
      OR EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE (b.tourist_id = c.uid AND b.guide_id = p.id)
           OR (b.guide_id = c.uid AND b.tourist_id = p.id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.tour_requests trq
        WHERE (trq.tourist_id = c.uid AND trq.guide_id = p.id)
           OR (trq.guide_id = c.uid AND trq.tourist_id = p.id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.trip_requests tr
        WHERE tr.user_id = p.id
          AND (
            tr.selected_guide_id = c.uid
            OR EXISTS (
              SELECT 1
              FROM public.trip_slots s
              WHERE s.trip_request_id = tr.id
                AND s.guide_id = c.uid
            )
            OR (
              c.is_eligible_provider
              AND tr.status IN ('active','pending','open','proposals_ready')
              AND (tr.expires_at IS NULL OR tr.expires_at > now())
            )
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.trip_requests tr
        WHERE tr.user_id = c.uid
          AND (
            tr.selected_guide_id = p.id
            OR EXISTS (
              SELECT 1
              FROM public.trip_slots s
              WHERE s.trip_request_id = tr.id
                AND s.guide_id = p.id
            )
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_participant_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_participant_profiles(uuid[]) TO authenticated;

-- Resolve the recipient for a tour inquiry without exposing the admin directory.
-- Existing behavior is preserved: prefer an explicit tour owner/guide/agency,
-- otherwise use the platform administrator as fallback.
CREATE OR REPLACE FUNCTION public.resolve_tour_request_recipient(p_tour_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_recipient uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(t.owner_id, t.guide_id, t.agency_id)
  INTO v_recipient
  FROM public.tours t
  WHERE t.id = p_tour_id;

  IF v_recipient IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_recipient
  ) THEN
    RETURN v_recipient;
  END IF;

  SELECT p.id
  INTO v_recipient
  FROM public.profiles p
  WHERE p.role = 'admin' OR p.is_admin IS TRUE
  ORDER BY p.created_at NULLS LAST, p.id
  LIMIT 1;

  RETURN v_recipient;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_tour_request_recipient(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_tour_request_recipient(uuid) TO authenticated;

-- Contact-release foundation. Before a booking is released, normal participants
-- receive no row. Admin may inspect for support/moderation. The function returns
-- only the caller's counterpart contact, never arbitrary profile data.
CREATE OR REPLACE FUNCTION public.get_booking_contact_details(p_booking_id uuid)
RETURNS TABLE (
  profile_id uuid,
  full_name text,
  email text,
  phone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_target uuid;
  v_is_admin boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_is_admin := public.current_user_is_admin();

  SELECT * INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT v_is_admin
     AND (SELECT auth.uid()) NOT IN (v_booking.tourist_id, v_booking.guide_id) THEN
    RAISE EXCEPTION 'Not authorized to view booking contacts';
  END IF;

  IF NOT v_is_admin AND v_booking.contact_released IS NOT TRUE THEN
    RETURN;
  END IF;

  IF v_is_admin THEN
    -- Admin support reads should use a dedicated admin surface; returning the
    -- traveler counterpart here keeps the function deterministic.
    v_target := v_booking.tourist_id;
  ELSIF (SELECT auth.uid()) = v_booking.tourist_id THEN
    v_target := v_booking.guide_id;
  ELSE
    v_target := v_booking.tourist_id;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    COALESCE(NULLIF(p.phone_number, ''), p.phone)
  FROM public.profiles p
  WHERE p.id = v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.get_booking_contact_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_contact_details(uuid) TO authenticated;

-- Prepare explicit admin SELECT authorization before broad profile SELECT is
-- removed. current_user_is_admin() avoids self-referential RLS recursion.
DROP POLICY IF EXISTS "Admins can select profiles" ON public.profiles;
CREATE POLICY "Admins can select profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.current_user_is_admin());

-- Replace the old recursive admin UPDATE policy with the stable helper.
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

NOTIFY pgrst, 'reload schema';