-- Rollback: revert v_user_stats from MATERIALIZED VIEW back to a regular view.

-- Remove the pg_cron job if it exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh-v-user-stats');
  END IF;
END $$;

DROP MATERIALIZED VIEW IF EXISTS v_user_stats;

CREATE OR REPLACE VIEW v_user_stats AS
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
  FROM bookings WHERE status = 'pending'
  GROUP BY passenger_id
) pending_bookings ON p.id = pending_bookings.passenger_id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS count
  FROM trips WHERE status IN ('published', 'active')
  GROUP BY user_id
) active_trips ON p.id = active_trips.user_id
LEFT JOIN (
  SELECT recipient_id, COUNT(*) AS count
  FROM messages WHERE read_at IS NULL
  GROUP BY recipient_id
) unread_messages ON p.id = unread_messages.recipient_id
LEFT JOIN (
  SELECT user_id, COUNT(*) AS count
  FROM notifications WHERE read_at IS NULL
  GROUP BY user_id
) unread_notifications ON p.id = unread_notifications.user_id;
