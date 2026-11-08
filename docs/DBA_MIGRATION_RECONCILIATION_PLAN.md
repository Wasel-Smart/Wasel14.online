# DBA Migration Reconciliation & Authorized Execution Plan

**Prepared:** 2026-11-09  
**Project:** `zexlxabdcsjefptmjhuq` (wasel14.online)  
**Status:** BLOCKED — do not run `supabase db push` until all steps below are signed off  
**Authority required:** DBA + project owner sign-off before Step 4

---

## 1. Current State of Divergence

### Remote-only (applied in production, no local file)
None confirmed — remote history was fetched on 2026-11-03.

### Local-only (in repo, NOT applied remotely)

| Version | File | Risk | Rollback |
|---|---|---|---|
| `20261017000000` | ~~rls_price_and_view_hardening~~ | **QUARANTINED** — targets wrong schema columns; would break every booking insert | Quarantine file exists; do NOT move back without rewrite |
| `20261018000000` | fix_profiles_rls_soft_delete | Medium | rollback/ ✅ |
| `20261019000000` | materialize_user_stats | Low | rollback/ ✅ |
| `20261019000001` | fix_unique_active_booking_constraint | Medium | rollback/ ✅ |
| `20261019000002` | ledger_wallet_balance | **High** — wallet double-spend guard | rollback/ ✅ |
| `20261028000000` | close_wallet_pin_hash_client_access | **High** — PIN hash exposure | rollback/ ✅ |
| `20261101000000` | trips_column_normalization | Medium | rollback/ ✅ |
| `20261101000001` | ledger_drift_alert_and_schema_health | Low | rollback/ ✅ |
| `20261102000000` | schema_hygiene_completeness | Low | rollback/ ✅ |
| `20261103000000` | retired_identity_review_workflow | Low | rollback/ ✅ |
| `20261103230701` | secure_sensitive_rpc_execution | **High** — locks wallet/booking RPCs to service_role | none yet — **create before applying** |
| `20261107231309` | align_chat_runtime_contract | Medium — required by chat handler | rollback/ ✅ |
| `20261108025826` | harden_supabase_admin_default_privileges | Medium — fail-closed for future tables | none yet — **create before applying** |
| `20261108120000` | pin_search_path_wallet_balance_fn | Low — search_path hardening | none yet — **create before applying** |
| `20261109000000` | outbox_backoff_and_lock | Medium — adds columns + functions | rollback/ ✅ |

### Unmatched on both sides (local file exists, version not in remote history)
- `20260302_regionalization_schema.sql`
- `20260310_security_performance_fixes.sql`

These predate the baseline. DBA must confirm whether their content is already reflected in the remote schema before deciding to repair or skip.

### Already repaired
- `20261108014245` — executed directly and marked applied on 2026-11-08. ✅

---

## 2. Pre-Reconciliation Checklist (DBA actions — read-only first)

```bash
# 1. Confirm current remote migration list
supabase migration list --linked

# 2. Confirm schema state of the two unmatched early files
supabase db query --linked \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;"

# 3. Take a verified backup BEFORE any write
pg_dump -Fc "$SUPABASE_DB_URL" > backup_pre_reconcile_$(date +%Y%m%d_%H%M%S).dump
pg_restore --list backup_pre_reconcile_*.dump | head -30   # verify it is readable

# 4. Run the read-only security audit — record output
psql "$SUPABASE_DB_URL" -f supabase/ops/production-readiness-audit.sql > audit_pre.txt
psql "$SUPABASE_DB_URL" -f supabase/ops/audit_client_privileges.sql   >> audit_pre.txt
```

---

## 3. Missing Rollback Scripts (create before Step 4)

Three local-only migrations have no rollback file. Create them now:

### `rollback/20261103230701_secure_sensitive_rpc_execution_rollback.sql`

```sql
BEGIN;
-- Restore EXECUTE to authenticated for the service-only RPCs.
-- WARNING: this re-exposes privileged wallet/booking functions to the Data API.
DO $$
DECLARE
  fn_names text[] := ARRAY[
    'wallet_post_transaction','app_add_wallet_funds','app_transfer_wallet_funds',
    'app_create_trip','app_book_trip','app_assign_package_to_trip',
    'app_withdraw_wallet_funds','app_pay_with_wallet','app_credit_driver_earnings',
    'app_confirm_package_delivery','app_approve_driver','increment_balance',
    'decrement_balance','increment_pending_balance','app_create_ride_booking',
    'app_cancel_trip_booking','app_get_driver_rating'
  ];
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(fn_names)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
```

### `rollback/20261108025826_harden_supabase_admin_default_privileges_rollback.sql`

```sql
BEGIN;
-- Restore implicit grants for objects created by supabase_admin.
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
  GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
COMMIT;
```

### `rollback/20261108120000_pin_search_path_wallet_balance_fn_rollback.sql`

```sql
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.get_authoritative_wallet_balance(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.get_authoritative_wallet_balance(uuid)
      RESET search_path;
    GRANT EXECUTE ON FUNCTION public.get_authoritative_wallet_balance(uuid) TO authenticated;
  END IF;
END $$;
COMMIT;
```

---

## 4. Authorized Execution Path

**Gate:** DBA confirms backup is readable AND pre-audit output is recorded. Project owner signs off.

Apply in this exact order using `supabase db query --linked` (not `db push`). Each step is a single file. Verify between steps.

```bash
# ── STEP 1: Profiles RLS soft-delete fix ──────────────────────────────────────
supabase db query --linked \
  --file supabase/migrations/20261018000000_fix_profiles_rls_soft_delete.sql
supabase migration repair 20261018000000 --status applied --linked

# ── STEP 2: Materialize user stats ────────────────────────────────────────────
supabase db query --linked \
  --file supabase/migrations/20261019000000_materialize_user_stats.sql
supabase migration repair 20261019000000 --status applied --linked

# ── STEP 3: Fix unique active booking constraint ───────────────────────────────
supabase db query --linked \
  --file supabase/migrations/20261019000001_fix_unique_active_booking_constraint.sql
supabase migration repair 20261019000001 --status applied --linked

# ── STEP 4: Ledger wallet balance (HIGH — drain in-flight txns first) ──────────
# Pre-condition: confirm zero pending wallet transactions
psql "$SUPABASE_DB_URL" -c \
  "SELECT COUNT(*) FROM public.wallet_transactions WHERE status = 'pending';"
supabase db query --linked \
  --file supabase/migrations/20261019000002_ledger_wallet_balance.sql
supabase migration repair 20261019000002 --status applied --linked

# ── STEP 5: Close wallet PIN hash client access (HIGH) ────────────────────────
supabase db query --linked \
  --file supabase/migrations/20261028000000_close_wallet_pin_hash_client_access.sql
supabase migration repair 20261028000000 --status applied --linked

# ── STEP 6: Trips column normalization ────────────────────────────────────────
supabase db query --linked \
  --file supabase/migrations/20261101000000_trips_column_normalization.sql
supabase migration repair 20261101000000 --status applied --linked

# ── STEP 7: Ledger drift alert & schema health ────────────────────────────────
supabase db query --linked \
  --file supabase/migrations/20261101000001_ledger_drift_alert_and_schema_health.sql
supabase migration repair 20261101000001 --status applied --linked

# ── STEP 8: Schema hygiene completeness ───────────────────────────────────────
supabase db query --linked \
  --file supabase/migrations/20261102000000_schema_hygiene_completeness.sql
supabase migration repair 20261102000000 --status applied --linked

# ── STEP 9: Retire identity review workflow ───────────────────────────────────
supabase db query --linked \
  --file supabase/migrations/20261103000000_retired_identity_review_workflow.sql
supabase migration repair 20261103000000 --status applied --linked

# ── STEP 10: Secure sensitive RPC execution (HIGH) ────────────────────────────
supabase db query --linked \
  --file supabase/migrations/20261103230701_secure_sensitive_rpc_execution.sql
supabase migration repair 20261103230701 --status applied --linked

# ── STEP 11: Chat runtime contract (required before chat handler deploy) ───────
supabase db query --linked \
  --file supabase/migrations/20261107231309_align_chat_runtime_contract.sql
supabase migration repair 20261107231309 --status applied --linked

# ── STEP 12: Harden supabase_admin default privileges ─────────────────────────
supabase db query --linked \
  --file supabase/migrations/20261108025826_harden_supabase_admin_default_privileges.sql
supabase migration repair 20261108025826 --status applied --linked

# ── STEP 13: Pin search_path on wallet balance function ───────────────────────
supabase db query --linked \
  --file supabase/migrations/20261108120000_pin_search_path_wallet_balance_fn.sql
supabase migration repair 20261108120000 --status applied --linked

# ── STEP 14: Outbox backoff and distributed lock ──────────────────────────────
supabase db query --linked \
  --file supabase/migrations/20261109000000_outbox_backoff_and_lock.sql
supabase migration repair 20261109000000 --status applied --linked
```

---

## 5. Post-Application Validation

Run after all 14 steps complete:

```sql
-- 1. Zero HIGH findings
\i supabase/ops/production-readiness-audit.sql

-- 2. Zero rows on queries 2, 4, 5 (client privilege probe)
\i supabase/ops/audit_client_privileges.sql

-- 3. All SECURITY DEFINER functions have search_path pinned
SELECT p.oid::regprocedure AS fn
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND NOT EXISTS (
    SELECT 1 FROM unnest(COALESCE(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%'
  );
-- Expected: 0 rows

-- 4. No table in public has RLS disabled
SELECT relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
-- Expected: 0 rows

-- 5. Wallet ledger integrity
SELECT * FROM public.reconcile_wallet_balances(false);
-- Expected: 0 rows

-- 6. Schema health
SELECT * FROM public.v_schema_health ORDER BY status DESC;
-- Expected: no 'alert' or 'stale' rows

-- 7. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
```

---

## 6. Quarantined Migration — Action Required

`supabase/migrations_quarantine/20261017000000_rls_price_and_view_hardening.sql` must be **rewritten** before it can be applied. It references `trips.id` (should be `trips.trip_id`) and `profiles` (removed). Steps:

1. Run `supabase db pull` to get the current remote schema.
2. Rewrite sections 1–3 against the real column names.
3. Save as a new file with a fresh timestamp (e.g. `20261110000000_rls_price_and_view_hardening_v2.sql`).
4. Create its rollback companion.
5. Test on a staging project restored from the production backup.
6. Add to the execution path above as Step 15.

Do not move the quarantine file back into `supabase/migrations/` as-is.

---

## 7. Unmatched Early Migrations

For `20260302` and `20260310`: after Step 5 above, run:

```bash
supabase db query --linked \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

If the tables/columns those files create already exist in the remote schema, mark them applied without re-executing:

```bash
supabase migration repair 20260302000000 --status applied --linked
supabase migration repair 20260310000000 --status applied --linked
```

If they are absent, apply them before Step 1 above.

---

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| DBA | | | |
| Project Owner | | | |
