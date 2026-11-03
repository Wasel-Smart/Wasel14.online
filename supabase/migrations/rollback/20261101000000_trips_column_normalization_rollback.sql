-- ============================================================================
-- ROLLBACK: 20261101000000_trips_column_normalization.sql
-- ============================================================================
-- WARNING: Re-adding dropped columns restores the column definitions but NOT
-- the data. If any application code wrote to origin_lat/origin_lng after the
-- forward migration was applied, those writes were silently discarded. Verify
-- data integrity before running this rollback in production.
-- ============================================================================

BEGIN;

-- 1. Restore the redundant alias coordinate columns.
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS origin_lat      DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS origin_lng      DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS destination_lat DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS destination_lng DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS origin          TEXT,
  ADD COLUMN IF NOT EXISTS destination     TEXT;

-- Back-fill from the canonical columns so the restored columns are not empty.
UPDATE public.trips SET
  origin_lat      = from_lat,
  origin_lng      = from_lng,
  destination_lat = to_lat,
  destination_lng = to_lng,
  origin          = from_location,
  destination     = to_location
WHERE from_lat IS NOT NULL;

-- 2. Remove the pg_cron schedule added by the forward migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh-trip-search-cache')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'refresh-trip-search-cache'
      );
  END IF;
END $$;

-- 3. Drop the geography sync trigger added by the forward migration.
DROP TRIGGER IF EXISTS trg_sync_trip_geography ON public.trips;
DROP FUNCTION IF EXISTS public.sync_trip_geography();

-- 4. Restore the broad authenticated grant.
-- NOTE: This re-opens the catch-all grant that the forward migration replaced
-- with explicit per-table grants. Review carefully before applying in production.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 5. Drop the BRIN indexes added by the forward migration.
DROP INDEX IF EXISTS public.idx_notifications_created_brin;
DROP INDEX IF EXISTS public.idx_analytics_events_created_brin;
DROP INDEX IF EXISTS public.idx_api_logs_created_brin;
DROP INDEX IF EXISTS public.idx_error_logs_created_brin;
DROP INDEX IF EXISTS public.idx_notifications_user_unread_covering;

COMMIT;
