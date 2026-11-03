-- ============================================================================
-- FIX: unique_active_booking constraint — make it non-deferrable
-- Migration: 20261019000001_fix_unique_active_booking_constraint.sql
-- Problem: The DEFERRABLE INITIALLY DEFERRED constraint on (trip_id, passenger_id)
--          allows duplicate bookings to exist within a single transaction. Any
--          multi-step booking flow that inserts and then updates in the same
--          transaction can bypass the uniqueness guarantee entirely.
-- Fix: Drop and recreate as a standard (non-deferrable) UNIQUE constraint so
--      the check fires immediately on INSERT, not at commit time.
-- ============================================================================

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS unique_active_booking;

ALTER TABLE public.bookings
  ADD CONSTRAINT unique_active_booking
    UNIQUE (trip_id, passenger_id);
