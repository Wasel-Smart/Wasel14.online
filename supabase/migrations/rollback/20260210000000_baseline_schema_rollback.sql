-- ============================================================================
-- WASEL PLATFORM - CONSOLIDATED BASELINE ROLLBACK
-- Rollback for: 20260210000000_baseline_schema.sql
-- ============================================================================

-- ============================================================================
-- SECTION ROLLBACK: 20261017_rls_price_and_view_hardening_rollback.sql
-- ============================================================================

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


-- ============================================================================
-- SECTION ROLLBACK: 20260310_security_performance_fixes_rollback.sql
-- ============================================================================

-- Rollback for 20260310_security_performance_fixes.sql
-- Generated: 2026-06-14T05:55:54.932Z
-- CRITICAL: Review and customize this rollback before using in production

BEGIN;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- This rollback script reverses the changes made by 20260310_security_performance_fixes.sql
-- 
-- BEFORE EXECUTING:
-- 1. Create a backup: pg_dump -Fc wasel > backup_$(date +%Y%m%d_%H%M%S).dump
-- 2. Test on staging environment first
-- 3. Verify data integrity after rollback
-- 4. Update application if schema changes affect code
-- ============================================================================

-- BACKUP CRITICAL DATA (uncomment if needed)
-- CREATE TABLE IF NOT EXISTS rollback_backup_$(date +%Y%m%d) AS 
-- SELECT * FROM [table_name] WHERE [conditions];

-- ALTER TABLE rollback statements (customize as needed)
-- ALTER TABLE [table_name] DROP COLUMN IF EXISTS [column_name];
-- DROP INDEX statements (customize as needed)
-- DROP INDEX IF EXISTS [index_name];
-- DELETE FROM statements (customize as needed)
-- DELETE FROM [table_name] WHERE [conditions];

-- Verify rollback completed successfully
DO $$
BEGIN
  RAISE NOTICE 'Rollback for 20260310_security_performance_fixes.sql completed at %', NOW();
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK CHECKLIST
-- ============================================================================
-- [ ] Verify application functionality
-- [ ] Check data integrity
-- [ ] Run performance tests
-- [ ] Update documentation
-- [ ] Notify team of rollback completion
-- ============================================================================

-- ============================================================================
-- SECTION ROLLBACK: 20260302_regionalization_schema_rollback.sql
-- ============================================================================

-- Rollback for 20260302_regionalization_schema.sql
-- Generated: 2026-06-14T05:55:54.926Z
-- CRITICAL: Review and customize this rollback before using in production

BEGIN;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- This rollback script reverses the changes made by 20260302_regionalization_schema.sql
-- 
-- BEFORE EXECUTING:
-- 1. Create a backup: pg_dump -Fc wasel > backup_$(date +%Y%m%d_%H%M%S).dump
-- 2. Test on staging environment first
-- 3. Verify data integrity after rollback
-- 4. Update application if schema changes affect code
-- ============================================================================

-- BACKUP CRITICAL DATA (uncomment if needed)
-- CREATE TABLE IF NOT EXISTS rollback_backup_$(date +%Y%m%d) AS 
-- SELECT * FROM [table_name] WHERE [conditions];

-- DROP TABLE statements (customize as needed)
-- DROP TABLE IF EXISTS [table_name] CASCADE;
-- ALTER TABLE rollback statements (customize as needed)
-- ALTER TABLE [table_name] DROP COLUMN IF EXISTS [column_name];
-- DROP INDEX statements (customize as needed)
-- DROP INDEX IF EXISTS [index_name];
-- DELETE FROM statements (customize as needed)
-- DELETE FROM [table_name] WHERE [conditions];

-- Verify rollback completed successfully
DO $$
BEGIN
  RAISE NOTICE 'Rollback for 20260302_regionalization_schema.sql completed at %', NOW();
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK CHECKLIST
-- ============================================================================
-- [ ] Verify application functionality
-- [ ] Check data integrity
-- [ ] Run performance tests
-- [ ] Update documentation
-- [ ] Notify team of rollback completion
-- ============================================================================

-- ============================================================================
-- SECTION ROLLBACK: 20260224_wasel_complete_schema_rollback.sql
-- ============================================================================

-- Rollback for 20260224_wasel_complete_schema.sql
-- Generated: 2026-06-14T05:55:54.922Z
-- CRITICAL: Review and customize this rollback before using in production

BEGIN;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- This rollback script reverses the changes made by 20260224_wasel_complete_schema.sql
-- 
-- BEFORE EXECUTING:
-- 1. Create a backup: pg_dump -Fc wasel > backup_$(date +%Y%m%d_%H%M%S).dump
-- 2. Test on staging environment first
-- 3. Verify data integrity after rollback
-- 4. Update application if schema changes affect code
-- ============================================================================

-- BACKUP CRITICAL DATA (uncomment if needed)
-- CREATE TABLE IF NOT EXISTS rollback_backup_$(date +%Y%m%d) AS 
-- SELECT * FROM [table_name] WHERE [conditions];

-- DROP TABLE statements (customize as needed)
-- DROP TABLE IF EXISTS [table_name] CASCADE;
-- ALTER TABLE rollback statements (customize as needed)
-- ALTER TABLE [table_name] DROP COLUMN IF EXISTS [column_name];
-- DROP INDEX statements (customize as needed)
-- DROP INDEX IF EXISTS [index_name];
-- DELETE FROM statements (customize as needed)
-- DELETE FROM [table_name] WHERE [conditions];

-- Verify rollback completed successfully
DO $$
BEGIN
  RAISE NOTICE 'Rollback for 20260224_wasel_complete_schema.sql completed at %', NOW();
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK CHECKLIST
-- ============================================================================
-- [ ] Verify application functionality
-- [ ] Check data integrity
-- [ ] Run performance tests
-- [ ] Update documentation
-- [ ] Notify team of rollback completion
-- ============================================================================

-- ============================================================================
-- SECTION ROLLBACK: 20260224_postgis_functions_rollback.sql
-- ============================================================================

-- Rollback for 20260224_postgis_functions.sql
-- Generated: 2026-06-14T05:55:54.918Z
-- CRITICAL: Review and customize this rollback before using in production

BEGIN;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- This rollback script reverses the changes made by 20260224_postgis_functions.sql
-- 
-- BEFORE EXECUTING:
-- 1. Create a backup: pg_dump -Fc wasel > backup_$(date +%Y%m%d_%H%M%S).dump
-- 2. Test on staging environment first
-- 3. Verify data integrity after rollback
-- 4. Update application if schema changes affect code
-- ============================================================================

-- BACKUP CRITICAL DATA (uncomment if needed)
-- CREATE TABLE IF NOT EXISTS rollback_backup_$(date +%Y%m%d) AS 
-- SELECT * FROM [table_name] WHERE [conditions];

-- DROP INDEX statements (customize as needed)
-- DROP INDEX IF EXISTS [index_name];
-- DELETE FROM statements (customize as needed)
-- DELETE FROM [table_name] WHERE [conditions];

-- Verify rollback completed successfully
DO $$
BEGIN
  RAISE NOTICE 'Rollback for 20260224_postgis_functions.sql completed at %', NOW();
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK CHECKLIST
-- ============================================================================
-- [ ] Verify application functionality
-- [ ] Check data integrity
-- [ ] Run performance tests
-- [ ] Update documentation
-- [ ] Notify team of rollback completion
-- ============================================================================

-- ============================================================================
-- SECTION ROLLBACK: 20260224000002_additional_tables_rollback.sql
-- ============================================================================

-- Rollback for 20260224000002_additional_tables.sql
-- Generated: 2026-06-14T05:55:54.915Z
-- CRITICAL: Review and customize this rollback before using in production

BEGIN;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- This rollback script reverses the changes made by 20260224000002_additional_tables.sql
-- 
-- BEFORE EXECUTING:
-- 1. Create a backup: pg_dump -Fc wasel > backup_$(date +%Y%m%d_%H%M%S).dump
-- 2. Test on staging environment first
-- 3. Verify data integrity after rollback
-- 4. Update application if schema changes affect code
-- ============================================================================

-- BACKUP CRITICAL DATA (uncomment if needed)
-- CREATE TABLE IF NOT EXISTS rollback_backup_$(date +%Y%m%d) AS 
-- SELECT * FROM [table_name] WHERE [conditions];

-- DROP TABLE statements (customize as needed)
-- DROP TABLE IF EXISTS [table_name] CASCADE;
-- ALTER TABLE rollback statements (customize as needed)
-- ALTER TABLE [table_name] DROP COLUMN IF EXISTS [column_name];
-- DROP INDEX statements (customize as needed)
-- DROP INDEX IF EXISTS [index_name];
-- DELETE FROM statements (customize as needed)
-- DELETE FROM [table_name] WHERE [conditions];

-- Verify rollback completed successfully
DO $$
BEGIN
  RAISE NOTICE 'Rollback for 20260224000002_additional_tables.sql completed at %', NOW();
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK CHECKLIST
-- ============================================================================
-- [ ] Verify application functionality
-- [ ] Check data integrity
-- [ ] Run performance tests
-- [ ] Update documentation
-- [ ] Notify team of rollback completion
-- ============================================================================

-- ============================================================================
-- SECTION ROLLBACK: 20260224000001_backup_configuration_rollback.sql
-- ============================================================================

-- Rollback for 20260224000001_backup_configuration.sql
-- Generated: 2026-06-14T05:55:54.913Z
-- CRITICAL: Review and customize this rollback before using in production

BEGIN;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- This rollback script reverses the changes made by 20260224000001_backup_configuration.sql
-- 
-- BEFORE EXECUTING:
-- 1. Create a backup: pg_dump -Fc wasel > backup_$(date +%Y%m%d_%H%M%S).dump
-- 2. Test on staging environment first
-- 3. Verify data integrity after rollback
-- 4. Update application if schema changes affect code
-- ============================================================================

-- BACKUP CRITICAL DATA (uncomment if needed)
-- CREATE TABLE IF NOT EXISTS rollback_backup_$(date +%Y%m%d) AS 
-- SELECT * FROM [table_name] WHERE [conditions];

-- DROP TABLE statements (customize as needed)
-- DROP TABLE IF EXISTS [table_name] CASCADE;
-- DROP INDEX statements (customize as needed)
-- DROP INDEX IF EXISTS [index_name];
-- DELETE FROM statements (customize as needed)
-- DELETE FROM [table_name] WHERE [conditions];

-- Verify rollback completed successfully
DO $$
BEGIN
  RAISE NOTICE 'Rollback for 20260224000001_backup_configuration.sql completed at %', NOW();
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK CHECKLIST
-- ============================================================================
-- [ ] Verify application functionality
-- [ ] Check data integrity
-- [ ] Run performance tests
-- [ ] Update documentation
-- [ ] Notify team of rollback completion
-- ============================================================================

-- ============================================================================
-- SECTION ROLLBACK: 20260224000000_production_backend_schema_rollback.sql
-- ============================================================================

-- Rollback for 20260224000000_production_backend_schema.sql
-- Generated: 2026-06-14T05:55:54.895Z
-- CRITICAL: Review and customize this rollback before using in production

BEGIN;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- This rollback script reverses the changes made by 20260224000000_production_backend_schema.sql
-- 
-- BEFORE EXECUTING:
-- 1. Create a backup: pg_dump -Fc wasel > backup_$(date +%Y%m%d_%H%M%S).dump
-- 2. Test on staging environment first
-- 3. Verify data integrity after rollback
-- 4. Update application if schema changes affect code
-- ============================================================================

-- BACKUP CRITICAL DATA (uncomment if needed)
-- CREATE TABLE IF NOT EXISTS rollback_backup_$(date +%Y%m%d) AS 
-- SELECT * FROM [table_name] WHERE [conditions];

-- DROP TABLE statements (customize as needed)
-- DROP TABLE IF EXISTS [table_name] CASCADE;
-- ALTER TABLE rollback statements (customize as needed)
-- ALTER TABLE [table_name] DROP COLUMN IF EXISTS [column_name];
-- DROP INDEX statements (customize as needed)
-- DROP INDEX IF EXISTS [index_name];

-- Verify rollback completed successfully
DO $$
BEGIN
  RAISE NOTICE 'Rollback for 20260224000000_production_backend_schema.sql completed at %', NOW();
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK CHECKLIST
-- ============================================================================
-- [ ] Verify application functionality
-- [ ] Check data integrity
-- [ ] Run performance tests
-- [ ] Update documentation
-- [ ] Notify team of rollback completion
-- ============================================================================

-- ============================================================================
-- SECTION ROLLBACK: 20260223000000_production_schema_rollback.sql
-- ============================================================================

-- Rollback for 20260223000000_production_schema.sql
-- Generated: 2026-06-14T05:55:54.884Z
-- CRITICAL: Review and customize this rollback before using in production

BEGIN;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- This rollback script reverses the changes made by 20260223000000_production_schema.sql
-- 
-- BEFORE EXECUTING:
-- 1. Create a backup: pg_dump -Fc wasel > backup_$(date +%Y%m%d_%H%M%S).dump
-- 2. Test on staging environment first
-- 3. Verify data integrity after rollback
-- 4. Update application if schema changes affect code
-- ============================================================================

-- BACKUP CRITICAL DATA (uncomment if needed)
-- CREATE TABLE IF NOT EXISTS rollback_backup_$(date +%Y%m%d) AS 
-- SELECT * FROM [table_name] WHERE [conditions];

-- DROP TABLE statements (customize as needed)
-- DROP TABLE IF EXISTS [table_name] CASCADE;
-- ALTER TABLE rollback statements (customize as needed)
-- ALTER TABLE [table_name] DROP COLUMN IF EXISTS [column_name];
-- DROP INDEX statements (customize as needed)
-- DROP INDEX IF EXISTS [index_name];

-- Verify rollback completed successfully
DO $$
BEGIN
  RAISE NOTICE 'Rollback for 20260223000000_production_schema.sql completed at %', NOW();
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK CHECKLIST
-- ============================================================================
-- [ ] Verify application functionality
-- [ ] Check data integrity
-- [ ] Run performance tests
-- [ ] Update documentation
-- [ ] Notify team of rollback completion
-- ============================================================================

-- ============================================================================
-- SECTION ROLLBACK: 20260210_complete_schema_rollback.sql
-- ============================================================================

-- Rollback for 20260210_complete_schema.sql
-- Generated: 2026-06-14T05:55:54.878Z
-- CRITICAL: Review and customize this rollback before using in production

BEGIN;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- This rollback script reverses the changes made by 20260210_complete_schema.sql
-- 
-- BEFORE EXECUTING:
-- 1. Create a backup: pg_dump -Fc wasel > backup_$(date +%Y%m%d_%H%M%S).dump
-- 2. Test on staging environment first
-- 3. Verify data integrity after rollback
-- 4. Update application if schema changes affect code
-- ============================================================================

-- BACKUP CRITICAL DATA (uncomment if needed)
-- CREATE TABLE IF NOT EXISTS rollback_backup_$(date +%Y%m%d) AS 
-- SELECT * FROM [table_name] WHERE [conditions];

-- DROP TABLE statements (customize as needed)
-- DROP TABLE IF EXISTS [table_name] CASCADE;
-- ALTER TABLE rollback statements (customize as needed)
-- ALTER TABLE [table_name] DROP COLUMN IF EXISTS [column_name];
-- DROP INDEX statements (customize as needed)
-- DROP INDEX IF EXISTS [index_name];

-- Verify rollback completed successfully
DO $$
BEGIN
  RAISE NOTICE 'Rollback for 20260210_complete_schema.sql completed at %', NOW();
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK CHECKLIST
-- ============================================================================
-- [ ] Verify application functionality
-- [ ] Check data integrity
-- [ ] Run performance tests
-- [ ] Update documentation
-- [ ] Notify team of rollback completion
-- ============================================================================

