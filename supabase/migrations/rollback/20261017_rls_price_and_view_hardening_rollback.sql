-- ============================================================================
-- WASEL RLS / PRICING / VIEW HARDENING ROLLBACK
-- Migration: rollback/20261017_rls_price_and_view_hardening_rollback.sql
-- Description: Reverts the RLS / pricing / view hardening migration.
-- ============================================================================

DROP TRIGGER IF EXISTS a_bookings_pricing_guard ON public.bookings;
DROP FUNCTION IF EXISTS public.guard_booking_pricing();

DROP POLICY IF EXISTS "Shared KV user-scoped select" ON public.shared_kv;
DROP POLICY IF EXISTS "Shared KV user-scoped write" ON public.shared_kv;

DROP VIEW IF EXISTS public.v_user_bookings;
DROP VIEW IF EXISTS public.v_user_stats;

DROP POLICY IF EXISTS "Client roles cannot see booking pricing" ON public.bookings;
