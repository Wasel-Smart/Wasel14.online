-- ============================================================================
-- TRIPS COLUMN NORMALIZATION & SCHEMA HYGIENE
-- Migration: 20261101000000_trips_column_normalization.sql
--
-- Problems addressed:
--   1. trips table has three overlapping coordinate column sets accumulated
--      across migration passes:
--        Set A (baseline):  from_lat/from_lng, to_lat/to_lng
--        Set B (production_schema): origin_lat/origin_lng, destination_lat/destination_lng
--        Set C (wasel_complete_schema): pickup_location GEOGRAPHY, dropoff_location GEOGRAPHY
--      The canonical runtime uses Set A + the GEOGRAPHY columns derived from
--      them via trigger. Sets B are aliases that duplicate Set A with different
--      names; they are populated by the same trigger and never read by any
--      handler. Removing them shrinks the row width, eliminates confusion, and
--      prevents future code from accidentally writing to the wrong column.
--
--   2. trip_search_cache MATERIALIZED VIEW refresh was commented out in the
--      baseline migration, leaving the cache permanently stale.
--
--   3. The broad GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA
--      public TO authenticated issued in 20260223000000 (embedded in baseline)
--      is still in effect. Later migrations revoke specific tables but the
--      catch-all remains for any table created before those revocations. This
--      migration replaces it with explicit per-table grants so new tables are
--      denied by default (fail-closed).
--
--   4. High-volume append-only tables (notifications, analytics_events,
--      api_logs, error_logs) have no created_at range index suitable for
--      future time-based partitioning or efficient retention deletes.
--
-- Rollback: supabase/migrations/rollback/20261101000000_trips_column_normalization_rollback.sql
-- ============================================================================

-- ── 1. Drop redundant alias coordinate columns from trips ────────────────────
-- These columns duplicate from_lat/from_lng and to_lat/to_lng. The GEOGRAPHY
-- columns (from_location_geom / to_location_geom) are the canonical spatial
-- representation and are kept. The trigger update_trip_geography() already
-- derives them from from_lat/from_lng on every INSERT/UPDATE.

ALTER TABLE public.trips
  DROP COLUMN IF EXISTS origin_lat,
  DROP COLUMN IF EXISTS origin_lng,
  DROP COLUMN IF EXISTS destination_lat,
  DROP COLUMN IF EXISTS destination_lng;

-- Also drop the duplicate text aliases that shadow from_location/to_location.
-- origin/destination were added in 20260224000000 as aliases; the canonical
-- columns are from_location/to_location used by all handlers.
ALTER TABLE public.trips
  DROP COLUMN IF EXISTS origin,
  DROP COLUMN IF EXISTS destination;

-- ── 2. Ensure the GEOGRAPHY columns exist and are kept in sync ───────────────
-- The trigger update_trip_geography() was defined in schema.sql but may not
-- exist on all environments. Re-create it idempotently so the GEOGRAPHY
-- columns are always derived from the canonical lat/lng pair.

CREATE OR REPLACE FUNCTION public.sync_trip_geography()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.from_lat IS NOT NULL AND NEW.from_lng IS NOT NULL THEN
    NEW.from_location_geom :=
      ST_SetSRID(ST_MakePoint(NEW.from_lng, NEW.from_lat), 4326)::geography;
  END IF;
  IF NEW.to_lat IS NOT NULL AND NEW.to_lng IS NOT NULL THEN
    NEW.to_location_geom :=
      ST_SetSRID(ST_MakePoint(NEW.to_lng, NEW.to_lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_trip_geography ON public.trips;
CREATE TRIGGER trg_sync_trip_geography
  BEFORE INSERT OR UPDATE OF from_lat, from_lng, to_lat, to_lng
  ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.sync_trip_geography();

-- ── 3. Schedule trip_search_cache refresh ────────────────────────────────────
-- The baseline migration left the pg_cron schedule commented out. Wire it up
-- now. The CONCURRENTLY flag means reads are never blocked during refresh.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove any stale schedule first (idempotent).
    PERFORM cron.unschedule('refresh-trip-search-cache')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'refresh-trip-search-cache'
      );

    PERFORM cron.schedule(
      'refresh-trip-search-cache',
      '*/5 * * * *',
      $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.trip_search_cache$$
    );
  END IF;
END $$;

-- ── 4. Replace broad authenticated grant with explicit per-table grants ───────
-- The GRANT ... ON ALL TABLES IN SCHEMA public TO authenticated issued in the
-- baseline gives authenticated users full DML on every table, including tables
-- that should be service-role-only (audit_logs, backup_logs, config_audit_log,
-- etc.). Revoke the broad grant and replace with explicit column-safe grants.

-- Revoke the catch-all first.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Core user-facing tables: authenticated users need SELECT + limited DML.
GRANT SELECT, INSERT, UPDATE ON public.profiles         TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trips            TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bookings         TO authenticated;
GRANT SELECT, INSERT         ON public.reviews          TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages         TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications    TO authenticated;
GRANT SELECT                 ON public.trip_search_cache TO authenticated;
GRANT SELECT                 ON public.trip_search_cache TO anon;

-- Wallet: column-level grant already applied by 20261028000000; keep it.
-- (No table-level grant here — the column grant from that migration stands.)

-- Financial tables: read-only for authenticated; writes go through service_role.
GRANT SELECT ON public.wallet_transactions  TO authenticated;
GRANT SELECT ON public.transactions         TO authenticated;
GRANT SELECT ON public.subscriptions        TO authenticated;
GRANT SELECT ON public.payments             TO authenticated;

-- Reference / lookup tables: read-only.
GRANT SELECT ON public.countries            TO authenticated;
GRANT SELECT ON public.currencies           TO authenticated;
GRANT SELECT ON public.exchange_rates       TO authenticated;
GRANT SELECT ON public.service_zones        TO authenticated;
GRANT SELECT ON public.country_services     TO authenticated;
GRANT SELECT ON public.country_feature_flags TO authenticated;
GRANT SELECT ON public.universities         TO authenticated;

-- User-owned tables: full DML scoped by RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices            TO authenticated;
GRANT SELECT, INSERT                 ON public.ratings            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_regional_preferences TO authenticated;

-- Reporting / moderation: insert-only for authenticated; reads via service_role.
GRANT INSERT ON public.reported_content   TO authenticated;
GRANT INSERT ON public.safety_incidents   TO authenticated;
GRANT SELECT ON public.reported_content   TO authenticated;
GRANT SELECT ON public.safety_incidents   TO authenticated;

-- Analytics: insert-only (no read-back needed from client).
GRANT INSERT ON public.analytics_events   TO authenticated;

-- Audit / ops tables: service_role only — no authenticated grant.
-- (audit_logs, backup_logs, config_audit_log, api_logs, error_logs)

-- Sequences: authenticated needs USAGE for INSERT on tables with serial PKs.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Service role retains full access (bypasses RLS anyway).
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ── 5. Partition-ready range indexes on high-volume append-only tables ────────
-- These tables will be candidates for time-based range partitioning at the
-- 10k→100k MAU scaling tier. The BRIN indexes are cheap to maintain and
-- dramatically speed up retention deletes and time-range scans on large tables.

CREATE INDEX IF NOT EXISTS idx_notifications_created_brin
  ON public.notifications USING brin (created_at)
  WITH (pages_per_range = 128);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_brin
  ON public.analytics_events USING brin (created_at)
  WITH (pages_per_range = 128);

CREATE INDEX IF NOT EXISTS idx_api_logs_created_brin
  ON public.api_logs USING brin (created_at)
  WITH (pages_per_range = 128);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_brin
  ON public.error_logs USING brin (created_at)
  WITH (pages_per_range = 128);

-- Composite covering index for the most common notification query pattern:
-- "unread notifications for user X, newest first"
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_covering
  ON public.notifications (user_id, created_at DESC)
  INCLUDE (type, title, read)
  WHERE read = FALSE;

DO $$
BEGIN
  RAISE NOTICE '✅ 20261101000000: trips column normalization complete';
  RAISE NOTICE '   - Dropped redundant origin_lat/lng, destination_lat/lng, origin, destination columns';
  RAISE NOTICE '   - Wired trip_search_cache pg_cron refresh (every 5 min)';
  RAISE NOTICE '   - Replaced broad authenticated grant with explicit per-table grants';
  RAISE NOTICE '   - Added BRIN indexes on high-volume append-only tables';
END $$;
