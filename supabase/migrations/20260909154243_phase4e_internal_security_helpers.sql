-- Phase 4E: move internal SECURITY DEFINER authorization helpers out of the
-- exposed public API schema and make server-only payment-event denial explicit.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_user_is_admin()
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

REVOKE ALL ON FUNCTION private.current_user_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_reviewable_profile_target(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_profile_id
      AND p.role IN ('guide','agency')
  );
$$;

REVOKE ALL ON FUNCTION private.is_reviewable_profile_target(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_reviewable_profile_target(uuid) TO authenticated, service_role;

-- Preserve policy semantics exactly while changing only helper schema references.
DO $$
DECLARE
  r record;
  v_qual text;
  v_check text;
  v_sql text;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      p.polname AS policy_name,
      pg_get_expr(p.polqual, p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE (
      COALESCE(pg_get_expr(p.polqual, p.polrelid), '') LIKE '%current_user_is_admin()%'
      OR COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '') LIKE '%current_user_is_admin()%'
      OR COALESCE(pg_get_expr(p.polqual, p.polrelid), '') LIKE '%is_reviewable_profile_target(%'
      OR COALESCE(pg_get_expr(p.polwithcheck, p.polrelid), '') LIKE '%is_reviewable_profile_target(%'
    )
  LOOP
    v_qual := r.qual;
    v_check := r.with_check;

    IF v_qual IS NOT NULL THEN
      v_qual := replace(v_qual, 'current_user_is_admin()', 'private.current_user_is_admin()');
      v_qual := replace(v_qual, 'is_reviewable_profile_target(', 'private.is_reviewable_profile_target(');
    END IF;
    IF v_check IS NOT NULL THEN
      v_check := replace(v_check, 'current_user_is_admin()', 'private.current_user_is_admin()');
      v_check := replace(v_check, 'is_reviewable_profile_target(', 'private.is_reviewable_profile_target(');
    END IF;

    v_sql := format('ALTER POLICY %I ON %I.%I', r.policy_name, r.schema_name, r.table_name);
    IF v_qual IS NOT NULL THEN
      v_sql := v_sql || ' USING (' || v_qual || ')';
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || ' WITH CHECK (' || v_check || ')';
    END IF;
    EXECUTE v_sql;
  END LOOP;
END $$;

-- Public RPCs that require admin awareness now call the private helper.
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

  v_is_admin := private.current_user_is_admin();

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
      private.current_user_is_admin() AS is_admin
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

-- No public API caller needs these internal helpers after policy/function rewiring.
DROP FUNCTION public.current_user_is_admin();
DROP FUNCTION public.is_reviewable_profile_target(uuid);

-- This table is deliberately service-role only. An explicit deny-all browser
-- policy documents that intent and removes the ambiguous no-policy advisor item.
DROP POLICY IF EXISTS payment_provider_events_no_browser_access ON public.payment_provider_events;
CREATE POLICY payment_provider_events_no_browser_access
ON public.payment_provider_events
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

NOTIFY pgrst, 'reload schema';