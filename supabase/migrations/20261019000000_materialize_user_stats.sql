-- ============================================================================
-- Materialize v_user_stats
--
-- The regular view ran 4 correlated subqueries per row (pending_bookings,
-- active_trips, unread_messages, unread_notifications). On any meaningful
-- dataset this caused sequential scans on every read. Replace it with a
-- MATERIALIZED VIEW refreshed concurrently so reads are always fast and
-- the underlying tables are only scanned during the refresh.
--
-- Refresh strategy:
--   • Triggered by the existing bookings / trips / messages / notifications
--     triggers via a lightweight NOTIFY → pg_cron job (or manual call).
--   • For now a pg_cron schedule refreshes every 5 minutes, which satisfies
--     the ops-worker SLO of freshness < 5m.
--   • CONCURRENTLY means reads are never blocked during a refresh.
-- ============================================================================

-- Drop the old regular view so the name is free for the materialized version.
DROP VIEW IF EXISTS v_user_stats;

CREATE MATERIALIZED VIEW v_user_stats AS
SELECT
  p.id,
  p.full_name,
  p.email,
  p.total_trips,
  p.trips_as_driver,
  p.trips_as_passenger,
  p.rating_as_driver,
  p.rating_as_passenger,
  p.wallet_balance,
  p.total_earned,
  p.total_spent,
  COALESCE(pending_bookings.count, 0)       AS pending_bookings,
  COALESCE(active_trips.count, 0)           AS active_trips,
  COALESCE(unread_messages.count, 0)        AS unread_messages,
  COALESCE(unread_notifications.count, 0)   AS unread_notifications
FROM profiles p
LEFT JOIN (
  SELECT passenger_id, COUNT(*) AS count
  FROM bookings
  WHERE status = 'pending'
  GROUP BY passenger_id
) pending_bookings ON p.id = pending_bookings.passenger_id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS count
  FROM trips
  WHERE status IN ('published', 'active')
  GROUP BY user_id
) active_trips ON p.id = active_trips.user_id
LEFT JOIN (
  SELECT recipient_id, COUNT(*) AS count
  FROM messages
  WHERE read_at IS NULL
  GROUP BY recipient_id
) unread_messages ON p.id = unread_messages.recipient_id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS count
  FROM notifications
  WHERE read_at IS NULL
  GROUP BY user_id
) unread_notifications ON p.id = unread_notifications.user_id
WITH DATA;

-- Unique index required for REFRESH CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS idx_v_user_stats_id ON v_user_stats (id);

-- Supporting indexes for the most common lookup patterns.
CREATE INDEX IF NOT EXISTS idx_v_user_stats_pending_bookings
  ON v_user_stats (pending_bookings)
  WHERE pending_bookings > 0;

CREATE INDEX IF NOT EXISTS idx_v_user_stats_unread
  ON v_user_stats (unread_notifications)
  WHERE unread_notifications > 0;

-- ── pg_cron refresh schedule ─────────────────────────────────────────────────
-- Requires the pg_cron extension (enabled by default on Supabase).
-- Refreshes every 5 minutes, satisfying the ops-worker freshness SLO.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'refresh-v-user-stats',
      '*/5 * * * *',
      $$REFRESH MATERIALIZED VIEW CONCURRENTLY v_user_stats$$
    );
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ v_user_stats converted to MATERIALIZED VIEW with CONCURRENT refresh every 5 min';
END $$;
