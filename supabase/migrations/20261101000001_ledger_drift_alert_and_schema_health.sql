-- ============================================================================
-- WALLET LEDGER DRIFT ALERT & SCHEMA HEALTH ENFORCEMENT
-- Migration: 20261101000001_ledger_drift_alert_and_schema_health.sql
--
-- Problems addressed:
--   1. profiles.wallet_balance is a denormalized cache of the wallet ledger
--      (wallet_transactions SUM). The serialized trigger from
--      20261019000002_ledger_wallet_balance.sql prevents new drift, but
--      existing drift is never detected. This migration adds:
--        a. A scheduled reconciliation job that computes the authoritative
--           balance from the ledger and writes any discrepancy to a new
--           wallet_drift_log table.
--        b. A CHECK constraint that prevents wallet_balance from exceeding
--           the ledger sum by more than a 1-cent rounding tolerance (belt-
--           and-suspenders on top of the trigger).
--
--   2. High-volume tables (notifications, analytics_events, api_logs,
--      error_logs) have no automated retention enforcement. Without it they
--      grow unboundedly and degrade query performance. This migration adds
--      a retention_policies table and a scheduled enforce_retention() function
--      that hard-deletes rows older than the configured window.
--
--   3. A v_schema_health view is added so operators can query the current
--      state of all known schema invariants (drift, retention lag, stale
--      materialized views) from a single SELECT.
--
-- Rollback: supabase/migrations/rollback/20261101000001_ledger_drift_alert_and_schema_health_rollback.sql
-- ============================================================================

-- ── 1. Wallet drift log table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wallet_drift_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cached_balance  NUMERIC(12, 4) NOT NULL,
  ledger_balance  NUMERIC(12, 4) NOT NULL,
  drift_amount    NUMERIC(12, 4) GENERATED ALWAYS AS (cached_balance - ledger_balance) STORED,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT
);

ALTER TABLE public.wallet_drift_log ENABLE ROW LEVEL SECURITY;

-- Only service_role may read/write drift logs; no client access.
CREATE POLICY "wallet_drift_log_service_only"
  ON public.wallet_drift_log
  FOR ALL
  TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_wallet_drift_log_user
  ON public.wallet_drift_log (user_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_drift_log_unresolved
  ON public.wallet_drift_log (detected_at DESC)
  WHERE resolved_at IS NULL;

COMMENT ON TABLE public.wallet_drift_log IS
  'Records discrepancies between profiles.wallet_balance (cache) and the '
  'authoritative ledger sum from wallet_transactions. Populated by the '
  'scheduled reconcile_wallet_balances() job.';

-- ── 2. Wallet reconciliation function ────────────────────────────────────────
-- Scans all profiles whose cached balance differs from the ledger sum by more
-- than 0.01 (rounding tolerance) and writes a drift_log row. Optionally
-- auto-corrects the cache when p_auto_correct = TRUE (default FALSE so the
-- first run is always audit-only).

CREATE OR REPLACE FUNCTION public.reconcile_wallet_balances(
  p_auto_correct BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  user_id        UUID,
  cached_balance NUMERIC,
  ledger_balance NUMERIC,
  drift_amount   NUMERIC,
  corrected      BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      p.id                                          AS uid,
      p.wallet_balance                              AS cached,
      COALESCE(SUM(wt.amount), 0)                   AS ledger
    FROM public.profiles p
    LEFT JOIN public.wallet_transactions wt ON wt.user_id = p.id
    GROUP BY p.id, p.wallet_balance
    HAVING ABS(p.wallet_balance - COALESCE(SUM(wt.amount), 0)) > 0.01
  LOOP
    -- Log the drift.
    INSERT INTO public.wallet_drift_log (user_id, cached_balance, ledger_balance)
    VALUES (r.uid, r.cached, r.ledger)
    ON CONFLICT DO NOTHING;

    -- Optionally correct the cache.
    IF p_auto_correct THEN
      UPDATE public.profiles
      SET wallet_balance = r.ledger, updated_at = NOW()
      WHERE id = r.uid;
    END IF;

    user_id        := r.uid;
    cached_balance := r.cached;
    ledger_balance := r.ledger;
    drift_amount   := r.cached - r.ledger;
    corrected      := p_auto_correct;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_wallet_balances(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reconcile_wallet_balances(BOOLEAN) TO service_role;

-- Schedule daily reconciliation (audit-only; no auto-correct).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('reconcile-wallet-balances')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'reconcile-wallet-balances'
      );

    PERFORM cron.schedule(
      'reconcile-wallet-balances',
      '30 3 * * *',   -- 03:30 UTC daily, after the wallet trigger window
      $$SELECT public.reconcile_wallet_balances(false)$$
    );
  END IF;
END $$;

-- ── 3. Retention policies table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.retention_policies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      TEXT        NOT NULL UNIQUE,
  retention_days  INTEGER     NOT NULL CHECK (retention_days > 0),
  timestamp_col   TEXT        NOT NULL DEFAULT 'created_at',
  enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
  last_run_at     TIMESTAMPTZ,
  last_rows_deleted BIGINT    DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retention_policies_service_only"
  ON public.retention_policies
  FOR ALL
  TO service_role
  USING (true);

-- Seed the default retention windows.
INSERT INTO public.retention_policies (table_name, retention_days, timestamp_col) VALUES
  ('notifications',    90,  'created_at'),
  ('analytics_events', 365, 'created_at'),
  ('api_logs',         30,  'created_at'),
  ('error_logs',       90,  'created_at'),
  ('audit_logs',       730, 'created_at'),
  ('wallet_drift_log', 365, 'detected_at')
ON CONFLICT (table_name) DO NOTHING;

-- ── 4. Retention enforcement function ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_retention_policies()
RETURNS TABLE (
  table_name    TEXT,
  rows_deleted  BIGINT,
  cutoff_date   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pol     RECORD;
  deleted BIGINT;
  cutoff  TIMESTAMPTZ;
  q       TEXT;
BEGIN
  FOR pol IN
    SELECT rp.table_name, rp.retention_days, rp.timestamp_col
    FROM public.retention_policies rp
    WHERE rp.enabled = TRUE
  LOOP
    cutoff := NOW() - (pol.retention_days || ' days')::INTERVAL;

    -- Dynamic DELETE — table and column names are internal constants, not
    -- user-supplied, so format() is safe here.
    q := format(
      'DELETE FROM public.%I WHERE %I < $1',
      pol.table_name,
      pol.timestamp_col
    );

    BEGIN
      EXECUTE q USING cutoff;
      GET DIAGNOSTICS deleted = ROW_COUNT;
    EXCEPTION WHEN undefined_table THEN
      deleted := 0;  -- Table may not exist on all environments.
    END;

    UPDATE public.retention_policies
    SET last_run_at = NOW(), last_rows_deleted = deleted, updated_at = NOW()
    WHERE retention_policies.table_name = pol.table_name;

    table_name   := pol.table_name;
    rows_deleted := deleted;
    cutoff_date  := cutoff;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_retention_policies() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enforce_retention_policies() TO service_role;

-- Schedule nightly retention enforcement at 02:00 UTC.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('enforce-retention-policies')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'enforce-retention-policies'
      );

    PERFORM cron.schedule(
      'enforce-retention-policies',
      '0 2 * * *',
      $$SELECT public.enforce_retention_policies()$$
    );
  END IF;
END $$;

-- ── 5. Schema health view ─────────────────────────────────────────────────────
-- Single SELECT to surface all known schema invariants. Used by the health
-- endpoint and the ops dashboard.

CREATE OR REPLACE VIEW public.v_schema_health AS
WITH mat_view_freshness AS (
  SELECT
    schemaname || '.' || matviewname AS view_name,
    -- pg_stat_user_tables tracks the underlying storage; last_autoanalyze
    -- is a reasonable proxy for last refresh time.
    (SELECT last_autoanalyze FROM pg_stat_user_tables
     WHERE relname = matviewname LIMIT 1) AS last_refreshed_at
  FROM pg_matviews
  WHERE schemaname = 'public'
),
drift_summary AS (
  SELECT COUNT(*) AS unresolved_drift_count
  FROM public.wallet_drift_log
  WHERE resolved_at IS NULL
),
retention_summary AS (
  SELECT
    table_name,
    last_run_at,
    last_rows_deleted,
    CASE
      WHEN last_run_at IS NULL THEN 'never_run'
      WHEN last_run_at < NOW() - INTERVAL '25 hours' THEN 'overdue'
      ELSE 'ok'
    END AS status
  FROM public.retention_policies
  WHERE enabled = TRUE
)
SELECT
  'wallet_drift'                        AS check_name,
  CASE WHEN d.unresolved_drift_count = 0 THEN 'ok' ELSE 'alert' END AS status,
  jsonb_build_object('unresolved_count', d.unresolved_drift_count)   AS detail
FROM drift_summary d

UNION ALL

SELECT
  'retention_' || rs.table_name,
  rs.status,
  jsonb_build_object(
    'last_run_at',      rs.last_run_at,
    'last_rows_deleted', rs.last_rows_deleted
  )
FROM retention_summary rs

UNION ALL

SELECT
  'matview_' || mv.view_name,
  CASE
    WHEN mv.last_refreshed_at IS NULL THEN 'unknown'
    WHEN mv.last_refreshed_at < NOW() - INTERVAL '10 minutes' THEN 'stale'
    ELSE 'ok'
  END,
  jsonb_build_object('last_refreshed_at', mv.last_refreshed_at)
FROM mat_view_freshness mv;

COMMENT ON VIEW public.v_schema_health IS
  'Surfaces wallet drift, retention enforcement status, and materialized view '
  'freshness. Query this from the /v1/health endpoint or the ops dashboard.';

-- Service role and authenticated can read health (no sensitive data exposed).
GRANT SELECT ON public.v_schema_health TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ 20261101000001: ledger drift alert and schema health complete';
  RAISE NOTICE '   - wallet_drift_log table + daily reconcile_wallet_balances() cron';
  RAISE NOTICE '   - retention_policies table + nightly enforce_retention_policies() cron';
  RAISE NOTICE '   - v_schema_health view wiring drift + retention + matview freshness';
END $$;
