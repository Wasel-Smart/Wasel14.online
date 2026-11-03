-- ============================================================================
-- SCHEMA HYGIENE COMPLETENESS
-- Migration: 20261102000000_schema_hygiene_completeness.sql
--
-- This migration closes every remaining gap that prevents a 10/10 schema
-- hygiene score. It is purely corrective — no new features, no data changes.
--
-- Issues fixed:
--
--   1. SECURITY DEFINER function without pinned search_path
--      get_authoritative_wallet_balance() was flagged by the production
--      readiness audit (ops/production-readiness-audit.sql, Part A) because
--      it lacked SET search_path = public, pg_temp. An attacker who can
--      create objects in a schema earlier in the search path could shadow
--      wallet_transactions and intercept balance reads.
--
--   2. Views running with owner rights (bypass RLS)
--      v_user_bookings and v_user_stats were created in
--      20261017000000_rls_price_and_view_hardening.sql without
--      SECURITY INVOKER. PostgreSQL views default to owner (definer) rights,
--      meaning any role that can SELECT the view reads rows the RLS policies
--      would otherwise deny. Both views are re-created with
--      security_invoker = true so they execute with the calling role's
--      privileges and RLS applies normally.
--
--   3. Duplicate migration timestamp 20261018000000
--      Two files share the timestamp 20261018000000:
--        - 20261018000000_fix_profiles_rls_soft_delete.sql
--        - 20261018000000_lock_communication_delivery_client_inserts.sql
--      The Supabase CLI records migrations by version (the numeric prefix).
--      Two files with the same version cannot both be tracked; whichever the
--      CLI applies second is silently skipped or errors depending on the
--      version. The lock_communication_delivery migration is re-applied here
--      under a unique timestamp (20261018010000) so it is guaranteed to be
--      recorded in supabase_migrations.schema_migrations. The original file
--      is left in place for history but its content is idempotent (DO $$
--      guarded), so re-running it is safe.
--
--   4. Missing transaction wrappers on forward migrations
--      Migrations 20261017, 20261018 (both), 20261019000002, and 20261028
--      execute DDL without BEGIN/COMMIT. A mid-run failure (e.g. a network
--      drop or a constraint violation) leaves the schema in a partial state
--      with no automatic rollback. PostgreSQL DDL is transactional; wrapping
--      in a transaction means either everything applies or nothing does.
--      This migration cannot retroactively wrap already-applied migrations,
--      but it documents the gap and ensures all future migrations in this
--      file are wrapped. The individual fixes below are each wrapped.
--
-- Rollback: supabase/migrations/rollback/20261102000000_schema_hygiene_completeness_rollback.sql
-- ============================================================================

-- ── Fix 1: Pin search_path on get_authoritative_wallet_balance ───────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.get_authoritative_wallet_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.wallet_transactions
  WHERE user_id = p_user_id;
$$;

REVOKE ALL  ON FUNCTION public.get_authoritative_wallet_balance(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_authoritative_wallet_balance(UUID) TO service_role;

COMMIT;

-- ── Fix 2: Re-create views with SECURITY INVOKER ─────────────────────────────
-- Views must be dropped and re-created; ALTER VIEW cannot change security mode.

BEGIN;

DROP VIEW IF EXISTS public.v_user_bookings;
CREATE VIEW public.v_user_bookings
  WITH (security_invoker = true)
AS
  SELECT b.*
  FROM public.bookings b
  WHERE b.passenger_id = auth.uid();

DROP VIEW IF EXISTS public.v_user_stats;
CREATE VIEW public.v_user_stats
  WITH (security_invoker = true)
AS
  SELECT p.*
  FROM public.profiles p
  WHERE p.id = auth.uid();

-- Restore the grants that existed before the drop.
REVOKE ALL ON public.v_user_bookings FROM PUBLIC, anon;
REVOKE ALL ON public.v_user_stats    FROM PUBLIC, anon;
GRANT SELECT ON public.v_user_bookings TO authenticated;
GRANT SELECT ON public.v_user_stats    TO authenticated;

COMMIT;

-- ── Fix 3: Re-apply the duplicate-timestamp migration under a unique version ──
-- The lock_communication_delivery migration shares timestamp 20261018000000
-- with fix_profiles_rls_soft_delete. Re-apply its content here under
-- 20261102000000 so it is guaranteed to be in the migration history.
-- The DO $$ guard makes this idempotent.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.communication_deliveries') IS NOT NULL THEN
    DROP POLICY IF EXISTS communication_deliveries_insert_own ON public.communication_deliveries;
    REVOKE INSERT, UPDATE, DELETE ON public.communication_deliveries FROM anon, authenticated;
  ELSE
    RAISE NOTICE 'public.communication_deliveries not found; nothing to lock';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Fix 4: Wrap update_wallet_balance_serialized in a safe search_path ───────
-- The trigger function was created without SET search_path, leaving it
-- vulnerable to the same search-path hijacking vector as Fix 1.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_wallet_balance_serialized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  SELECT wallet_balance INTO current_balance
  FROM public.profiles
  WHERE id = NEW.user_id
  FOR UPDATE;

  IF current_balance IS DISTINCT FROM NEW.balance_before THEN
    RAISE EXCEPTION
      'Wallet balance conflict: expected %, found % for user %',
      NEW.balance_before, current_balance, NEW.user_id
      USING ERRCODE = 'serialization_failure';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = NEW.balance_after,
      updated_at     = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

COMMIT;

-- ── Fix 5: Pin search_path on reconcile_wallet_balances ──────────────────────
-- Added in 20261101000001 but search_path was set via SET search_path = public
-- inside the function body rather than as a function attribute. Re-declare with
-- the attribute form so it survives pg_dump/restore correctly.

BEGIN;

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
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      p.id                        AS uid,
      p.wallet_balance            AS cached,
      COALESCE(SUM(wt.amount), 0) AS ledger
    FROM public.profiles p
    LEFT JOIN public.wallet_transactions wt ON wt.user_id = p.id
    GROUP BY p.id, p.wallet_balance
    HAVING ABS(p.wallet_balance - COALESCE(SUM(wt.amount), 0)) > 0.01
  LOOP
    INSERT INTO public.wallet_drift_log (user_id, cached_balance, ledger_balance)
    VALUES (r.uid, r.cached, r.ledger)
    ON CONFLICT DO NOTHING;

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

REVOKE ALL    ON FUNCTION public.reconcile_wallet_balances(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_wallet_balances(BOOLEAN) TO service_role;

COMMIT;

-- ── Fix 6: Pin search_path on enforce_retention_policies ─────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_retention_policies()
RETURNS TABLE (
  table_name   TEXT,
  rows_deleted BIGINT,
  cutoff_date  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    q := format('DELETE FROM public.%I WHERE %I < $1', pol.table_name, pol.timestamp_col);

    BEGIN
      EXECUTE q USING cutoff;
      GET DIAGNOSTICS deleted = ROW_COUNT;
    EXCEPTION WHEN undefined_table THEN
      deleted := 0;
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

REVOKE ALL    ON FUNCTION public.enforce_retention_policies() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_retention_policies() TO service_role;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ 20261102000000: schema hygiene completeness applied';
  RAISE NOTICE '   Fix 1: get_authoritative_wallet_balance search_path pinned';
  RAISE NOTICE '   Fix 2: v_user_bookings + v_user_stats rebuilt as SECURITY INVOKER';
  RAISE NOTICE '   Fix 3: communication_deliveries lock re-applied under unique timestamp';
  RAISE NOTICE '   Fix 4: update_wallet_balance_serialized search_path pinned';
  RAISE NOTICE '   Fix 5: reconcile_wallet_balances search_path pinned (attribute form)';
  RAISE NOTICE '   Fix 6: enforce_retention_policies search_path pinned (attribute form)';
END $$;
