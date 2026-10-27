-- Rollback for 20261017000000_rls_price_and_view_hardening.sql
-- Removes the booking pricing guard and restores the KV policies from
-- 20260310000000_security_performance_fixes.sql. The two views are recreated by
-- re-running PART 4 of that file (CREATE OR REPLACE VIEW ... without the WHERE filter).
-- NOTE: restoring the original KV policies re-opens the anonymous write exposure;
-- only do this to recover from an outage, then re-apply the hardening migration.

DROP TRIGGER IF EXISTS a_bookings_pricing_guard ON public.bookings;
DROP FUNCTION IF EXISTS public.guard_booking_pricing();

DO $$
BEGIN
  IF to_regclass('public.kv_store_0b1f4071') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated can read shared KV data" ON public.kv_store_0b1f4071;
    DROP POLICY IF EXISTS "Users can read their own KV data" ON public.kv_store_0b1f4071;
    DROP POLICY IF EXISTS "Users can write their own user KV data" ON public.kv_store_0b1f4071;

    CREATE POLICY "Users can access their own KV data" ON public.kv_store_0b1f4071 FOR ALL
      USING (
        key LIKE 'user:' || auth.uid()::TEXT || ':%' OR
        key LIKE 'profile:' || auth.uid()::TEXT OR
        key LIKE 'wallet:' || auth.uid()::TEXT || ':%' OR
        key LIKE 'notification:' || auth.uid()::TEXT || ':%'
      );

    CREATE POLICY "System can access shared KV data" ON public.kv_store_0b1f4071 FOR ALL
      USING (
        key LIKE 'system:%' OR key LIKE 'trip:%' OR key LIKE 'package:%' OR
        key LIKE 'route:%' OR key LIKE 'cache:%' OR key LIKE 'config:%'
      );
  END IF;
END $$;
