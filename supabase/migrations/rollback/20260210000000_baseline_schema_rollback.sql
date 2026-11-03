-- ============================================================================
-- ROLLBACK: 20260210000000_baseline_schema.sql
-- Drops every object created by the baseline in reverse dependency order.
-- Run ONLY on a fresh dev/staging database — never on production without a
-- prior pg_dump backup.
-- ============================================================================

BEGIN;

-- Publications
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.messages;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.notifications;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.trips;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.driver_locations;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.typing_indicators;

-- Materialized view
DROP MATERIALIZED VIEW IF EXISTS public.trip_search_cache CASCADE;

-- Views
DROP VIEW IF EXISTS public.active_trips_with_driver CASCADE;
DROP VIEW IF EXISTS public.backup_status CASCADE;

-- Triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Tables (leaf → root dependency order)
DROP TABLE IF EXISTS public.config_audit_log           CASCADE;
DROP TABLE IF EXISTS public.user_regional_preferences  CASCADE;
DROP TABLE IF EXISTS public.country_feature_flags      CASCADE;
DROP TABLE IF EXISTS public.country_services           CASCADE;
DROP TABLE IF EXISTS public.pricing_zones              CASCADE;
DROP TABLE IF EXISTS public.route_restrictions         CASCADE;
DROP TABLE IF EXISTS public.service_zones              CASCADE;
DROP TABLE IF EXISTS public.country_configs            CASCADE;
DROP TABLE IF EXISTS public.exchange_rates             CASCADE;
DROP TABLE IF EXISTS public.currencies                 CASCADE;
DROP TABLE IF EXISTS public.countries                  CASCADE;
DROP TABLE IF EXISTS public.health_checks              CASCADE;
DROP TABLE IF EXISTS public.system_alerts              CASCADE;
DROP TABLE IF EXISTS public.error_logs                 CASCADE;
DROP TABLE IF EXISTS public.api_logs                   CASCADE;
DROP TABLE IF EXISTS public.driver_status_history      CASCADE;
DROP TABLE IF EXISTS public.trip_analytics             CASCADE;
DROP TABLE IF EXISTS public.driver_payouts             CASCADE;
DROP TABLE IF EXISTS public.business_accounts          CASCADE;
DROP TABLE IF EXISTS public.student_verifications      CASCADE;
DROP TABLE IF EXISTS public.universities               CASCADE;
DROP TABLE IF EXISTS public.campaigns                  CASCADE;
DROP TABLE IF EXISTS public.devices                    CASCADE;
DROP TABLE IF EXISTS public.safety_incidents           CASCADE;
DROP TABLE IF EXISTS public.audit_logs                 CASCADE;
DROP TABLE IF EXISTS public.backup_logs                CASCADE;
DROP TABLE IF EXISTS public.profile_change_history     CASCADE;
DROP TABLE IF EXISTS public.analytics_events           CASCADE;
DROP TABLE IF EXISTS public.disputes                   CASCADE;
DROP TABLE IF EXISTS public.promo_code_usage           CASCADE;
DROP TABLE IF EXISTS public.promo_codes                CASCADE;
DROP TABLE IF EXISTS public.loyalty_transactions       CASCADE;
DROP TABLE IF EXISTS public.loyalty_points             CASCADE;
DROP TABLE IF EXISTS public.push_tokens                CASCADE;
DROP TABLE IF EXISTS public.fcm_tokens                 CASCADE;
DROP TABLE IF EXISTS public.driver_locations           CASCADE;
DROP TABLE IF EXISTS public.driver_documents           CASCADE;
DROP TABLE IF EXISTS public.reported_content           CASCADE;
DROP TABLE IF EXISTS public.favorites                  CASCADE;
DROP TABLE IF EXISTS public.transactions               CASCADE;
DROP TABLE IF EXISTS public.ratings                    CASCADE;
DROP TABLE IF EXISTS public.reviews                    CASCADE;
DROP TABLE IF EXISTS public.notifications              CASCADE;
DROP TABLE IF EXISTS public.typing_indicators          CASCADE;
DROP TABLE IF EXISTS public.messages                   CASCADE;
DROP TABLE IF EXISTS public.conversations              CASCADE;
DROP TABLE IF EXISTS public.processed_stripe_events    CASCADE;
DROP TABLE IF EXISTS public.subscriptions              CASCADE;
DROP TABLE IF EXISTS public.wallet_transactions        CASCADE;
DROP TABLE IF EXISTS public.wallets                    CASCADE;
DROP TABLE IF EXISTS public.payments                   CASCADE;
DROP TABLE IF EXISTS public.bookings                   CASCADE;
DROP TABLE IF EXISTS public.trips                      CASCADE;
DROP TABLE IF EXISTS public.vehicles                   CASCADE;
DROP TABLE IF EXISTS public.drivers                    CASCADE;
DROP TABLE IF EXISTS public.profiles                   CASCADE;

-- Functions
DROP FUNCTION IF EXISTS public.refresh_trip_search_cache()                                                CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_profile_changes()                                              CASCADE;
DROP FUNCTION IF EXISTS public.verify_backup_integrity()                                                  CASCADE;
DROP FUNCTION IF EXISTS public.update_countries_updated_at()                                              CASCADE;
DROP FUNCTION IF EXISTS public.log_profile_change()                                                       CASCADE;
DROP FUNCTION IF EXISTS public.update_wallet_balance()                                                    CASCADE;
DROP FUNCTION IF EXISTS public.update_profile_rating()                                                    CASCADE;
DROP FUNCTION IF EXISTS public.update_user_trip_stats()                                                   CASCADE;
DROP FUNCTION IF EXISTS public.check_no_self_booking()                                                    CASCADE;
DROP FUNCTION IF EXISTS public.update_trip_seats_after_booking()                                          CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user()                                                          CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column()                                                 CASCADE;

-- Enums
DROP TYPE IF EXISTS public.message_type         CASCADE;
DROP TYPE IF EXISTS public.notification_type    CASCADE;
DROP TYPE IF EXISTS public.payment_method_type  CASCADE;
DROP TYPE IF EXISTS public.payment_status       CASCADE;
DROP TYPE IF EXISTS public.booking_status       CASCADE;
DROP TYPE IF EXISTS public.trip_status          CASCADE;
DROP TYPE IF EXISTS public.trip_type            CASCADE;

-- Extensions (only drop if safe — comment out if shared with other projects)
-- DROP EXTENSION IF EXISTS "postgis";
-- DROP EXTENSION IF EXISTS "pg_trgm";
-- DROP EXTENSION IF EXISTS "pg_stat_statements";
-- DROP EXTENSION IF EXISTS "pgcrypto";
-- DROP EXTENSION IF EXISTS "uuid-ossp";

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Baseline schema rollback complete';
END $$;
