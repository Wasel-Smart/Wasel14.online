-- ============================================================================
-- WASEL RLS / PRICING / VIEW HARDENING MIGRATION
-- Migration: 20261017000000_rls_price_and_view_hardening.sql
-- Description: Guards booking price and payment columns from client writes;
--              derives new booking fares from the trip row; removes client
--              access to shared KV data; creates RLS-invoker per-user views;
--              revokes anonymous access to those views.
-- ============================================================================

-- ── Guard function: booking price/payment columns are server-owned ──────────
-- Protected columns: 'price_per_seat', 'total_price', 'payment_status', 'stripe_payment_intent_id'

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_booking_pricing()
RETURNS TRIGGER AS $$
DECLARE
  trip_unit_price NUMERIC;
  is_client_role BOOLEAN;
BEGIN
  is_client_role := current_user IN ('anon', 'authenticated')
    OR current_user LIKE 'anon%'
    OR current_user LIKE 'authenticated%';

  IF NEW.seats_requested IS NULL OR NEW.seats_requested < 1 THEN
    RAISE EXCEPTION 'Booking seats_requested must be at least one'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Never trust a client-supplied fare or payment state. Derive the fare from
    -- the selected trip before the booking is persisted.
    SELECT t.price_per_seat
      INTO trip_unit_price
      FROM public.trips AS t
     WHERE t.id = NEW.trip_id;

    IF NOT FOUND OR trip_unit_price IS NULL OR trip_unit_price < 0 THEN
      RAISE EXCEPTION 'Trip has no valid server-owned price'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.price_per_seat := trip_unit_price;
    NEW.total_price := trip_unit_price * NEW.seats_requested;

    IF is_client_role THEN
      NEW.payment_status := 'pending';
      NEW.stripe_payment_intent_id := NULL;
    END IF;
  ELSE
    -- A client must not change the trip, quantity, price, or payment state of
    -- an existing booking. Service-role code may update these fields after its
    -- own authorization and payment checks.
    IF is_client_role AND (
      NEW.trip_id IS DISTINCT FROM OLD.trip_id
      OR NEW.seats_requested IS DISTINCT FROM OLD.seats_requested
      OR NEW.price_per_seat IS DISTINCT FROM OLD.price_per_seat
      OR NEW.total_price IS DISTINCT FROM OLD.total_price
      OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
      OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
    ) THEN
      RAISE EXCEPTION 'Booking trip, quantity, price, and payment fields are server-owned'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.price_per_seat IS NULL OR NEW.price_per_seat < 0 THEN
      RAISE EXCEPTION 'Booking price_per_seat must be non-negative'
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.total_price := NEW.price_per_seat * NEW.seats_requested;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.guard_booking_pricing() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_bookings_pricing_guard ON public.bookings;
CREATE TRIGGER a_bookings_pricing_guard
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_pricing();

-- ── Remove unrestricted shared KV policy ────────────────────────────────────
-- Guarded: shared_kv may not exist on all environments.

DO $$
BEGIN
  IF to_regclass('public.shared_kv') IS NOT NULL THEN
    DROP POLICY IF EXISTS "System can access shared KV data" ON public.shared_kv;
    DROP POLICY IF EXISTS "Shared KV user-scoped select" ON public.shared_kv;
    DROP POLICY IF EXISTS "Shared KV user-scoped write" ON public.shared_kv;
    -- These keys do not encode a verified owner in a way PostgreSQL can safely
    -- compare with auth.uid(). Keep this internal store service-role-only.
    REVOKE ALL ON TABLE public.shared_kv FROM PUBLIC, anon, authenticated;
  ELSE
    RAISE NOTICE '20261017000000: public.shared_kv not found, skipping KV policy revoke';
  END IF;
END;
$$;

-- ── Per-user views filtered to caller ───────────────────────────────────────

CREATE OR REPLACE VIEW public.v_user_bookings
WITH (security_invoker = true) AS
SELECT b.*
FROM public.bookings b
WHERE b.passenger_id = auth.uid();

CREATE OR REPLACE VIEW public.v_user_stats
WITH (security_invoker = true) AS
SELECT p.*
FROM public.profiles p
WHERE p.id = auth.uid();

REVOKE ALL ON public.v_user_bookings FROM PUBLIC, anon;
REVOKE ALL ON public.v_user_stats FROM PUBLIC, anon;

-- ── RLS: keep booking reads scoped to the existing participant policies ─────

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS controls rows, not columns. This old blanket SELECT policy exposed every
-- booking (including payment fields) to anon/authenticated and defeated the
-- participant-scoped policies installed by the baseline migration. Remove it;
-- keep row visibility governed by the existing passenger/driver policies.
DROP POLICY IF EXISTS "Client roles cannot see booking pricing" ON public.bookings;

-- Price/payment writes are rejected by guard_booking_pricing().

COMMIT;
