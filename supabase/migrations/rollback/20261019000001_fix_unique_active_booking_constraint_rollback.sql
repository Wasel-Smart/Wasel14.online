-- ============================================================================
-- ROLLBACK: 20261019000001_fix_unique_active_booking_constraint.sql
-- Restores the DEFERRABLE INITIALLY DEFERRED constraint that the forward
-- migration replaced with a non-deferrable UNIQUE constraint.
-- WARNING: This re-opens the duplicate-booking window within a transaction.
-- ============================================================================

BEGIN;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS unique_active_booking;

ALTER TABLE public.bookings
  ADD CONSTRAINT unique_active_booking
    UNIQUE (trip_id, passenger_id) DEFERRABLE INITIALLY DEFERRED;

COMMIT;
