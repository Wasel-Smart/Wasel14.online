-- ============================================================================
-- ROLLBACK: 20261101000001_ledger_drift_alert_and_schema_health.sql
-- ============================================================================

BEGIN;

-- 1. Remove the pg_cron schedules.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('reconcile-wallet-balances')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'reconcile-wallet-balances'
      );
    PERFORM cron.unschedule('enforce-retention-policies')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'enforce-retention-policies'
      );
  END IF;
END $$;

-- 2. Drop the schema health view.
DROP VIEW IF EXISTS public.v_schema_health;

-- 3. Drop the retention enforcement function and table.
DROP FUNCTION IF EXISTS public.enforce_retention_policies();
DROP TABLE  IF EXISTS public.retention_policies;

-- 4. Drop the wallet reconciliation function and drift log table.
DROP FUNCTION IF EXISTS public.reconcile_wallet_balances(BOOLEAN);
DROP TABLE  IF EXISTS public.wallet_drift_log;

COMMIT;
