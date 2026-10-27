-- ============================================================================
-- Wasel RLS, pricing and view hardening
-- Date: 2026-10-17
--
-- !! DO NOT PUSH THIS FILE TO THE PRODUCTION PROJECT AS-IS !!
-- It was written against the LEGACY local schema (profiles, kv_store_0b1f4071,
-- trips.id, v_user_bookings). Production (zexlxabdcsjefptmjhuq) has none of
-- profiles / kv_store / v_user_* and keys trips by trip_id, so:
--   * sections 2 and 3 would silently do nothing, and
--   * the section 1 trigger would raise "column t.id does not exist" at runtime.
-- Production already blocks client writes to bookings (no INSERT/UPDATE policies,
-- RESTRICTIVE require_permanent_auth_user). Sync local migrations with production
-- (supabase db pull) and re-derive any hardening against the real schema first.
--
-- Closes three gaps found in a code review of 20260310000000_security_performance_fixes.sql:
--
--   1. bookings: RLS let a passenger INSERT a booking with any price and let a trip
--      owner UPDATE any column. The payments handler derives the amount to charge
--      from those columns, so a client could set its own fare (or mark its own
--      booking as paid). A BEFORE trigger now pins price and payment columns for
--      client roles; the edge function (service_role) is unaffected.
--
--   2. kv_store_0b1f4071: the "System can access shared KV data" policy had no
--      TO clause, so it applied to PUBLIC (including anon) with FOR ALL on the
--      trip:/package:/route:/system:/config:/cache: key prefixes. Client access is
--      now read-only for shared keys and write-limited to the caller's own user:
--      keys. The edge function uses service_role and is unaffected.
--
--   3. v_user_bookings / v_user_stats: views run with the owner's privileges, so
--      they bypassed RLS and exposed every user's email, wallet balance and every
--      booking (with driver phone) to any role holding SELECT. They now filter to
--      the calling user and are no longer granted to anon.
--
-- Safe to re-run. Review on a staging project before `supabase db push`.
-- Rollback: supabase/migrations/rollback/20261017_rls_price_and_view_hardening_rollback.sql
-- ============================================================================


-- ── 1. Booking price / payment guard ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_booking_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
  -- Columns only the server may change after a booking exists.
  locked_cols constant text[] := ARRAY[
    'price_per_seat', 'total_price', 'fare', 'amount', 'platform_fee',
    'currency', 'seats_requested',
    'payment_status', 'payment_intent_id', 'stripe_payment_intent_id', 'paid_at'
  ];
  paid_states constant text[] := ARRAY['succeeded', 'completed', 'paid', 'refunded'];
  new_j  jsonb := to_jsonb(NEW);
  old_j  jsonb;
  trip_j jsonb;
  patch  jsonb := '{}'::jsonb;
  col    text;
  unit   numeric;
  seats  numeric;
  given  numeric;
BEGIN
  -- Only client-facing roles are restricted. service_role (edge function),
  -- migrations and direct database connections have no request role and pass.
  IF caller_role NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_j := to_jsonb(OLD);
    FOREACH col IN ARRAY locked_cols LOOP
      IF (new_j ? col) AND (new_j -> col) IS DISTINCT FROM (old_j -> col) THEN
        RAISE EXCEPTION 'bookings.% is managed by the server and cannot be changed by clients', col
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  -- INSERT: a client cannot create a booking that is already paid or bound to a payment.
  IF lower(coalesce(new_j ->> 'payment_status', '')) = ANY (paid_states)
     OR coalesce(new_j ->> 'stripe_payment_intent_id', '') <> ''
     OR coalesce(new_j ->> 'payment_intent_id', '') <> ''
     OR (new_j ? 'paid_at' AND new_j ->> 'paid_at' IS NOT NULL) THEN
    RAISE EXCEPTION 'Payment fields are managed by the server' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(t) INTO trip_j FROM public.trips t WHERE t.id = NEW.trip_id;
  IF trip_j IS NULL THEN
    RAISE EXCEPTION 'Trip not found for booking' USING ERRCODE = '23503';
  END IF;

  unit := nullif(trip_j ->> 'price_per_seat', '')::numeric;
  IF unit IS NULL THEN
    RETURN NEW; -- older trip schema without a per-seat price: nothing to pin against
  END IF;

  seats := coalesce(nullif(new_j ->> 'seats_requested', '')::numeric, 1);
  IF seats < 1 OR seats <> trunc(seats) THEN
    RAISE EXCEPTION 'seats_requested must be a positive whole number' USING ERRCODE = '22023';
  END IF;

  -- The per-seat price always comes from the trip, never from the client.
  IF new_j ? 'price_per_seat' THEN
    patch := patch || jsonb_build_object('price_per_seat', unit);
  END IF;

  -- Totals may exceed trip price x seats (platform fee) but never fall below it.
  FOREACH col IN ARRAY ARRAY['total_price', 'fare', 'amount'] LOOP
    IF new_j ? col THEN
      given := coalesce(nullif(new_j ->> col, '')::numeric, 0);
      patch := patch || jsonb_build_object(col, greatest(given, unit * seats));
    END IF;
  END LOOP;

  IF new_j ? 'currency' AND nullif(trip_j ->> 'currency', '') IS NOT NULL THEN
    patch := patch || jsonb_build_object('currency', trip_j ->> 'currency');
  END IF;

  IF patch <> '{}'::jsonb THEN
    NEW := jsonb_populate_record(NEW, patch);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_booking_pricing() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    -- Named so it sorts (and therefore fires) before the updated_at / stats triggers.
    DROP TRIGGER IF EXISTS a_bookings_pricing_guard ON public.bookings;
    CREATE TRIGGER a_bookings_pricing_guard
      BEFORE INSERT OR UPDATE ON public.bookings
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_booking_pricing();
  ELSE
    RAISE NOTICE 'public.bookings not found; pricing guard trigger skipped';
  END IF;
END $$;


-- ── 2. KV store: no anonymous or client writes to shared keys ───────────────

DO $$
BEGIN
  IF to_regclass('public.kv_store_0b1f4071') IS NOT NULL THEN
    ALTER TABLE public.kv_store_0b1f4071 ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "System can access shared KV data" ON public.kv_store_0b1f4071;
    DROP POLICY IF EXISTS "Users can access their own KV data" ON public.kv_store_0b1f4071;
    DROP POLICY IF EXISTS "Authenticated can read shared KV data" ON public.kv_store_0b1f4071;
    DROP POLICY IF EXISTS "Users can read their own KV data" ON public.kv_store_0b1f4071;
    DROP POLICY IF EXISTS "Users can write their own user KV data" ON public.kv_store_0b1f4071;

    -- Shared, non-sensitive catalogue keys: readable by signed-in users only.
    CREATE POLICY "Authenticated can read shared KV data" ON public.kv_store_0b1f4071
      FOR SELECT TO authenticated
      USING (key LIKE 'trip:%' OR key LIKE 'package:%' OR key LIKE 'route:%');

    -- A user can read their own keys (wallet / notification stay read-only here:
    -- balances and notifications are written by the server only).
    CREATE POLICY "Users can read their own KV data" ON public.kv_store_0b1f4071
      FOR SELECT TO authenticated
      USING (
        key LIKE 'user:' || auth.uid()::text || ':%' OR
        key LIKE 'profile:' || auth.uid()::text OR
        key LIKE 'wallet:' || auth.uid()::text || ':%' OR
        key LIKE 'notification:' || auth.uid()::text || ':%'
      );

    -- Writes: only the caller's own user: namespace.
    CREATE POLICY "Users can write their own user KV data" ON public.kv_store_0b1f4071
      FOR ALL TO authenticated
      USING (key LIKE 'user:' || auth.uid()::text || ':%')
      WITH CHECK (key LIKE 'user:' || auth.uid()::text || ':%');

    -- "Service role can access all KV data" from 20260310 is kept as is.
  END IF;
END $$;


-- ── 3. Views: filter to the caller, no anonymous access ─────────────────────

DO $$
BEGIN
  IF to_regclass('public.v_user_bookings') IS NOT NULL THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW public.v_user_bookings AS
      SELECT
        b.id, b.trip_id, b.passenger_id, b.seats_requested,
        b.pickup_location, b.dropoff_location,
        b.pickup_coordinates, b.dropoff_coordinates,
        b.price_per_seat, b.total_price, b.currency, b.platform_fee,
        b.status, b.payment_status, b.payment_method, b.payment_intent_id, b.paid_at,
        b.cancellation_reason, b.cancelled_by, b.cancelled_at,
        b.special_requests, b.luggage_count,
        b.created_at, b.updated_at, b.accepted_at, b.completed_at,
        t.origin, t.destination, t.departure_time,
        t.price_per_seat AS trip_price_per_seat,
        t.status AS trip_status,
        p.full_name AS driver_name,
        p.avatar_url AS driver_avatar,
        p.rating_as_driver AS driver_rating,
        p.phone AS driver_phone
      FROM bookings b
      JOIN trips t ON b.trip_id = t.id
      JOIN profiles p ON t.user_id = p.id
      WHERE b.passenger_id = auth.uid()
         OR t.user_id = auth.uid()
         OR coalesce(auth.role(), '') = 'service_role'
    $v$;
    REVOKE ALL ON public.v_user_bookings FROM PUBLIC, anon;
    GRANT SELECT ON public.v_user_bookings TO authenticated, service_role;
  END IF;
EXCEPTION
  WHEN undefined_column OR undefined_table OR invalid_table_definition THEN
    RAISE NOTICE 'v_user_bookings left unchanged (schema differs): %', SQLERRM;
END $$;

DO $$
BEGIN
  IF to_regclass('public.v_user_stats') IS NOT NULL THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW public.v_user_stats AS
      SELECT
        p.id, p.full_name, p.email,
        p.total_trips, p.trips_as_driver, p.trips_as_passenger,
        p.rating_as_driver, p.rating_as_passenger,
        p.wallet_balance, p.total_earned, p.total_spent,
        COALESCE(pending_bookings.count, 0) AS pending_bookings,
        COALESCE(active_trips.count, 0) AS active_trips,
        COALESCE(unread_messages.count, 0) AS unread_messages,
        COALESCE(unread_notifications.count, 0) AS unread_notifications
      FROM profiles p
      LEFT JOIN (
        SELECT passenger_id, COUNT(*) AS count
        FROM bookings WHERE status = 'pending' GROUP BY passenger_id
      ) pending_bookings ON p.id = pending_bookings.passenger_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS count
        FROM trips WHERE status IN ('published', 'active') GROUP BY user_id
      ) active_trips ON p.id = active_trips.user_id
      LEFT JOIN (
        SELECT recipient_id, COUNT(*) AS count
        FROM messages WHERE read_at IS NULL GROUP BY recipient_id
      ) unread_messages ON p.id = unread_messages.recipient_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS count
        FROM notifications WHERE read_at IS NULL GROUP BY user_id
      ) unread_notifications ON p.id = unread_notifications.user_id
      WHERE p.id = auth.uid()
         OR coalesce(auth.role(), '') = 'service_role'
    $v$;
    REVOKE ALL ON public.v_user_stats FROM PUBLIC, anon;
    GRANT SELECT ON public.v_user_stats TO authenticated, service_role;
  END IF;
EXCEPTION
  WHEN undefined_column OR undefined_table OR invalid_table_definition THEN
    RAISE NOTICE 'v_user_stats left unchanged (schema differs): %', SQLERRM;
END $$;
