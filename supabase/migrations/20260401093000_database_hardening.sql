-- ============================================================================
-- WASEL DATABASE HARDENING MIGRATION
-- Migration: 20260401093000_database_hardening.sql
-- Description: Adds integrity constraints for package-enabled trips,
--              delivered packages, payment method defaults, and transaction
--              reference integrity. Adds operational indexes for auditability
--              and query performance.
-- ============================================================================

-- ── Trips: package slot bounds and package mode consistency ─────────────────

ALTER TABLE public.trips
  ADD CONSTRAINT chk_trips_package_slots_bounds
    CHECK (package_slots_remaining >= 0 AND package_slots_remaining <= package_capacity);

ALTER TABLE public.trips
  ADD CONSTRAINT chk_trips_package_mode_consistency
    CHECK (
      (allow_packages = FALSE AND package_capacity = 0 AND package_slots_remaining = 0)
      OR (allow_packages = TRUE AND package_capacity > 0 AND package_slots_remaining >= 0)
    );

-- ── Packages: delivery state constraint ─────────────────────────────────────

ALTER TABLE public.packages
  ADD CONSTRAINT chk_packages_delivery_state
    CHECK (
      (status = 'delivered' AND delivered_at IS NOT NULL)
      OR (status <> 'delivered' AND delivered_at IS NULL)
    );

-- ── Transactions: reference pair integrity ──────────────────────────────────

ALTER TABLE public.transactions
  ADD CONSTRAINT chk_transactions_reference_pair
    CHECK (
      (related_booking_id IS NOT NULL OR related_trip_id IS NOT NULL OR related_subscription_id IS NOT NULL)
      OR type IN ('wallet_topup', 'wallet_withdrawal', 'bonus', 'penalty')
    );

-- ── Payment methods: single default per user ────────────────────────────────

ALTER TABLE public.payment_methods
  ADD CONSTRAINT uq_payment_methods_default_per_user
    EXCLUDE USING btree (user_id) WITH (=)
    WHERE (is_default = TRUE);

CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.payment_methods
    SET is_default = FALSE
    WHERE user_id = NEW.user_id
      AND payment_method_id <> NEW.payment_method_id
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_single_default_payment_method ON public.payment_methods;
CREATE TRIGGER trg_ensure_single_default_payment_method
  BEFORE INSERT OR UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION ensure_single_default_payment_method();

-- ── Operational indexes ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bookings_passenger_status_created
  ON public.bookings (passenger_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_packages_sender_status_created
  ON public.packages (sender_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_package_events_package_created
  ON public.package_events (package_id, created_at DESC)
  WHERE package_id IS NOT NULL;
