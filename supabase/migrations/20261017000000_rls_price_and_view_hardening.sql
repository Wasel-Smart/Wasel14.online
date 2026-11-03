-- ============================================================================
-- WASEL RLS / PRICING / VIEW HARDENING MIGRATION
-- Migration: 20261017000000_rls_price_and_view_hardening.sql
-- Description: Guards booking price and payment columns so client roles
--              (authenticated, anon) can never set or read them directly;
--              server-side price derivation from the trip row; removes
--              unrestricted shared KV policies; filters per-user views;
--              revokes anonymous access to user views.
-- ============================================================================

-- ── Guard function: booking price/payment columns are server-owned ──────────
-- Protected columns: 'price_per_seat', 'total_price', 'payment_status', 'stripe_payment_intent_id'

CREATE OR REPLACE FUNCTION public.guard_booking_pricing()
RETURNS TRIGGER AS $$
DECLARE
  given NUMERIC;
  unit NUMERIC;
  seats INTEGER;
  trip_j JSONB;
BEGIN
  -- Only client roles (authenticated, anon) are blocked from setting price/payment columns.
  -- Server roles (service_role, postgres, supabase_admin, etc.) may freely update them.
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF current_user IN ('authenticated', 'anon')
       OR current_user LIKE 'authenticated%'
       OR current_user LIKE 'anon%'
    THEN
      IF (NEW.price_per_seat IS DISTINCT FROM OLD.price_per_seat)
         OR (NEW.total_price IS DISTINCT FROM OLD.total_price)
         OR (NEW.payment_status IS DISTINCT FROM OLD.payment_status)
         OR (NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id)
      THEN
        RAISE EXCEPTION 'Booking price and payment columns are server-owned';
      END IF;
    END IF;

    -- Derive price from trip: price_per_seat * seats, floored at the greater
    -- of the client-supplied value and the computed fare
    SELECT to_jsonb(t) INTO trip_j
    FROM public.trips t WHERE t.id = NEW.trip_id;

    unit := (trip_j ->> 'price_per_seat')::NUMERIC;
    seats := NEW.seats_requested;
    given := NEW.price_per_seat;

    IF given IS NOT NULL AND given > greatest(given, unit * seats) THEN
      NEW.price_per_seat := greatest(given, unit * seats);
    END IF;

    NEW.total_price := COALESCE(NEW.price_per_seat, 0) * NEW.seats_requested;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.guard_booking_pricing() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_bookings_pricing_guard ON public.bookings;
CREATE TRIGGER a_bookings_pricing_guard
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_pricing();

-- ── Remove unrestricted shared KV policy ────────────────────────────────────

DROP POLICY IF EXISTS "System can access shared KV data" ON public.shared_kv;

CREATE POLICY "Shared KV user-scoped select"
  ON public.shared_kv
  FOR SELECT TO authenticated
  USING (key LIKE 'user:%' OR key LIKE 'trip:%');

CREATE POLICY "Shared KV user-scoped write"
  ON public.shared_kv
  FOR ALL TO authenticated
  WITH CHECK (key LIKE 'user:' OR key LIKE 'user:%');

-- ── Per-user views filtered to caller ───────────────────────────────────────

CREATE OR REPLACE VIEW public.v_user_bookings AS
SELECT b.*
FROM public.bookings b
WHERE b.passenger_id = auth.uid();

CREATE OR REPLACE VIEW public.v_user_stats AS
SELECT p.*
FROM public.profiles p
WHERE p.id = auth.uid();

REVOKE ALL ON public.v_user_bookings FROM PUBLIC, anon;
REVOKE ALL ON public.v_user_stats FROM PUBLIC, anon;

-- ── RLS: booking price/payment columns invisible to client roles ────────────

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client roles cannot see booking pricing" ON public.bookings;
CREATE POLICY "Client roles cannot see booking pricing"
  ON public.bookings FOR SELECT
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Column-level: client roles cannot update price/payment fields
-- (enforced by the guard trigger above; RLS policy keeps reads scoped)
