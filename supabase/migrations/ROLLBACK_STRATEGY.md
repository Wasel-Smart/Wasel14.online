# Database Migration Rollback Strategy

> **Live-history warning (verified 2026-11-03):** the linked Supabase project has
> applied migration versions absent from the prior local history, and this checkout
> has local-only versions plus a duplicate `20261018000000` prefix. The historical
> graph and order below describe repository files only; they are **not** a safe
> production rollback sequence. Reconcile history and test against a restored copy
> before any database change. No migration or rollback was applied in this task.

## Principles

1. Every migration must have a rollback script before it is applied to any environment.
2. Rollback scripts must be tested on a dev/staging database before production deployment.
3. Data migrations must preserve data — rollbacks back-fill from canonical columns where possible.
4. Rollback scripts must be idempotent (`DROP … IF EXISTS`, `CREATE … IF NOT EXISTS`, `DO $$ … $$`).
5. Rollbacks must be executed in **reverse order** of the forward migrations.
6. Every rollback script must be wrapped in `BEGIN`/`COMMIT`.

---

## Local Migration Inventory

The files below show authoring order, not proof that the linked database applied
them. Use `supabase migration list --linked` as a read-only status check and resolve
all mismatches before attempting a rollout or rollback.

---

## Rollback Execution Order

Do not run rollback files based only on this list. The correct order depends on the
versions actually applied in the target environment, and the linked project does
not currently match the local-only sequence. Create an environment-specific plan,
test it against a restored database, and verify a backup before execution.

---

## Risk Assessment by Migration

### 1. Baseline Schema (20260210000000)
- **Risk:** Critical — drops all tables
- **Rollback Strategy:** `rollback/20260210000000_baseline_schema_rollback.sql`
- **Use:** Dev/staging only. Never run on production without a prior `pg_dump` backup.
- **Testing Required:** Full schema re-apply and smoke test after rollback.

### 2. Database Hardening (20260401093000)
- **Risk:** Low — additive constraints and indexes only
- **Rollback Strategy:** Drop the specific constraints and indexes added (`chk_trips_package_slots_bounds`, `chk_packages_delivery_state`, `chk_transactions_reference_pair`, `uq_payment_methods_default_per_user`, trigger `trg_ensure_single_default_payment_method`)
- **Testing Required:** Verify constraint violations are no longer blocked after rollback.

### 3. RLS / Pricing / View Hardening (20261017000000)
- **Risk:** Medium — removes booking price guard trigger; re-exposes pricing columns to clients
- **Rollback Strategy:** `rollback/20261017_rls_price_and_view_hardening_rollback.sql`
- **Testing Required:** Verify booking creation still works; verify price columns are not client-writable after re-applying.

### 4. Profiles RLS Soft-Delete Fix (20261018000000)
- **Risk:** Medium — restores the broken `USING (true)` policy that exposes soft-deleted users
- **Rollback Strategy:** `rollback/20261018_fix_profiles_rls_soft_delete_rollback.sql`
- **Testing Required:** Verify soft-deleted users are not visible after re-applying the forward migration.

### 5. Communication Deliveries Lock (20261018000000 — duplicate timestamp)
- **Risk:** Medium — restores the SMS/email relay vector
- **Rollback Strategy:** `rollback/20261018_lock_communication_delivery_client_inserts_rollback.sql`
- **Note:** This migration shares a timestamp with migration 4. Its content was re-applied under `20261102000000`. Rolling back migration 5 without rolling back migration 12 will have no effect.
- **Testing Required:** Verify the edge function communication path still works after rollback.

### 6. Materialize User Stats (20261019000000)
- **Risk:** Low — converts a view to a materialized view; rollback restores the regular view
- **Rollback Strategy:** `rollback/20261019000000_materialize_user_stats_rollback.sql`
- **Testing Required:** Verify dashboard stats load correctly after rollback (regular view has correlated subqueries — expect slower queries).

### 7. Fix Unique Active Booking Constraint (20261019000001)
- **Risk:** Medium — restores the deferrable constraint, re-opening the duplicate-booking window within a transaction
- **Rollback Strategy:** `rollback/20261019000001_fix_unique_active_booking_constraint_rollback.sql`
- **Testing Required:** Verify booking uniqueness is still enforced at commit time after rollback.

### 8. Ledger Wallet Balance (20261019000002)
- **Risk:** High — removes the serialized wallet trigger, re-opening the double-spend race condition
- **Rollback Strategy:** `rollback/20261019000002_ledger_wallet_balance_rollback.sql`
- **Pre-condition:** Drain all in-flight wallet transactions before applying rollback.
- **Testing Required:** Verify wallet balance updates still work; run reconciliation check.

### 9. Close Wallet PIN Hash Client Access (20261028000000)
- **Risk:** High — restores `pin_hash` exposure to authenticated clients
- **Rollback Strategy:** `rollback/20261028000000_close_wallet_pin_hash_client_access_rollback.sql`
- **Testing Required:** Verify wallet UI still works after rollback; audit any client code that reads `pin_hash`.

### 10. Trips Column Normalization (20261101000000)
- **Risk:** Medium — restores dropped columns but cannot restore data written to them after the forward migration
- **Rollback Strategy:** `rollback/20261101000000_trips_column_normalization_rollback.sql` — back-fills from canonical columns
- **Testing Required:** Verify no handler reads `origin_lat/lng` or `destination_lat/lng` after rollback.

### 11. Ledger Drift Alert & Schema Health (20261101000001)
- **Risk:** Low — additive only (new tables, functions, view, cron jobs)
- **Rollback Strategy:** `rollback/20261101000001_ledger_drift_alert_and_schema_health_rollback.sql`
- **Testing Required:** Verify wallet balance reconciliation still works via the trigger after rollback.

### 12. Schema Hygiene Completeness (20261102000000)
- **Risk:** Low — re-creates functions and views with security improvements; rollback restores less-secure versions
- **Rollback Strategy:** `rollback/20261102000000_schema_hygiene_completeness_rollback.sql`
- **Testing Required:** After rollback, run `supabase/ops/production-readiness-audit.sql` and expect HIGH findings to reappear for the affected functions and views.

---

## Emergency Rollback Procedure

### Step 1: Assess impact
```bash
# Check which migrations are applied
supabase migration list

# Check affected tables
psql "$SUPABASE_DB_URL" -c "\dt public.*"
```

### Step 2: Backup current state
```bash
pg_dump -Fc "$SUPABASE_DB_URL" > backup_$(date +%Y%m%d_%H%M%S).dump
pg_restore --list backup_*.dump | head -20  # verify backup
```

### Step 3: Execute rollback (newest first)
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/rollback/YYYYMMDDHHMMSS_description_rollback.sql
```

### Step 4: Verify data integrity
```bash
# Run the read-only audit
psql "$SUPABASE_DB_URL" -f supabase/ops/production-readiness-audit.sql
psql "$SUPABASE_DB_URL" -f supabase/ops/audit_client_privileges.sql

# Check wallet integrity
psql "$SUPABASE_DB_URL" -c "SELECT * FROM public.reconcile_wallet_balances(false);"
```

### Step 5: Restore application
```bash
# Reload PostgREST schema cache
psql "$SUPABASE_DB_URL" -c "NOTIFY pgrst, 'reload schema';"
```

---

## RTO / RPO Targets

| Scenario | RTO | RPO |
|----------|-----|-----|
| Schema-only rollback (no data change) | 5 min | 0 |
| Rollback with column back-fill | 15 min | last backup |
| Full baseline rollback (dev/staging) | 30 min | last backup |

---

## Rollback Testing Checklist

Before deploying any migration to production:

- [ ] Rollback script created and committed
- [ ] Rollback script is idempotent (safe to run twice)
- [ ] Rollback script is wrapped in `BEGIN`/`COMMIT`
- [ ] Rollback tested on dev database
- [ ] Rollback tested on staging database
- [ ] Data integrity verified after rollback on staging
- [ ] `production-readiness-audit.sql` shows no new HIGH findings after rollback
- [ ] Rollback time measured and within RTO target
- [ ] Rollback documented in this file

---

## References

- [Supabase Migration Docs](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Transactional DDL](https://www.postgresql.org/docs/current/ddl-alter.html)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)

---

**Last Updated:** 2026-11-02
**Version:** 3.0
**Status:** Active
