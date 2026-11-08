# Wasel Database Migrations

This folder contains all Supabase SQL migrations for the Wasel platform.

## Rules

1. Never edit an existing migration file once it has been applied to any environment.
2. Always create a new file for schema changes using the timestamp naming convention below.
3. Test migrations locally against a Supabase dev project before running on staging or production.
4. Migrations run in filename (lexicographic) order — timestamps must be unique.
5. Every migration must have a corresponding rollback script in `rollback/`.
6. Every migration that modifies data or drops objects must be wrapped in `BEGIN`/`COMMIT`.

---

## Naming Convention

```text
YYYYMMDDHHMMSS_short_description.sql
```

Example: `20261101000000_trips_column_normalization.sql`

Rollback files mirror the forward migration name:

```text
rollback/YYYYMMDDHHMMSS_short_description_rollback.sql
```

**Important:** Two files must never share the same `YYYYMMDDHHMMSS` prefix. The Supabase CLI
records migrations by the numeric version; a duplicate version causes the second file to be
silently skipped or to error. If a collision is discovered after the fact, re-apply the
affected content under a new unique timestamp (see migration 20261102000000 for an example).

---

## Linked Project Migration State (verified 2026-11-03)

The linked project history was queried with `supabase migration list --linked`, and
the missing remote migration files were fetched with `supabase migration fetch --linked`.
This exposed a real mismatch between the repository and the linked database. This
section supersedes any earlier “Applied” labels in this file.

Remote history includes `20260125000000`, `20260320000000`, `20260326080000`,
`20260327090000`, `20260327110000`, `20260401093000`, `20260401113000`,
`20260401133000`, `20260401143000`, the four `20260720*` migrations, and the four
`20261009*` migrations. The exact scripts for these versions are present locally now.

The CLI reports local-only versions `20260210000000`, `20261017000000`,
`20261018000000` (two files collide on this version), `20261019000000`,
`20261019000001`, `20261019000002`, `20261028000000`, `20261101000000`,
`20261101000001`, `20261102000000`, and `20261103000000`. It also reports
`20260302` and `20260310` as unmatched on both sides despite local files with those
names. **Do not run `supabase db push` from this checkout** until the migration
history, duplicate version, and local-only changes have been reconciled against a
backup and reviewed plan. No migrations were applied during this audit.

Treat migration history on the linked project as authoritative. Do not use the
consolidated `20260210000000_baseline_schema.sql` as a production reset/cutover on
an existing project: it is not in the linked project's applied migration history.

### Follow-up audit snapshot (2026-11-08)

The linked history was queried again with `supabase migration list --linked` on
2026-11-08. The mismatch remains. In addition to the versions listed above, the
following local migrations were not present remotely at that time:

- `20261103230701_secure_sensitive_rpc_execution.sql`
- `20261107231309_align_chat_runtime_contract.sql`

The linked project did contain `20261103164909`, `20261107140000`, and
`20261107224630`. The chat contract migration is required by the current local
chat handler and must be applied before deploying that handler. Do not mark any
migration as applied manually or push this history until the duplicate timestamp,
all local-only changes, and a backup-based cutover sequence have been reviewed.
This snapshot records read-only CLI output; it does not attest to the contents
or health of a deployed Edge Function.

The schema cleanup migration `20261108014245_remove_retired_identity_schema.sql`
was executed transactionally with `supabase db query --linked` on 2026-11-08 and
verified against the linked schema. The version was then marked applied with
`supabase migration repair 20261108014245 --status applied --linked` so the
database history matches the already-executed SQL. This repairs only that exact
version. Other local-only migrations remain unresolved; do not push them until
the broader history is reconciled.

---

## Rollback Coverage

Every migration has a corresponding rollback script:

| Migration | Rollback Script |
|-----------|----------------|
| `20260210000000_baseline_schema.sql` | `rollback/20260210000000_baseline_schema_rollback.sql` |
| `20260401093000_database_hardening.sql` | *(additive constraints only — drop constraints to revert)* |
| `20261017000000_rls_price_and_view_hardening.sql` | `rollback/20261017_rls_price_and_view_hardening_rollback.sql` |
| `20261018000000_fix_profiles_rls_soft_delete.sql` | `rollback/20261018_fix_profiles_rls_soft_delete_rollback.sql` |
| `20261018000000_lock_communication_delivery_client_inserts.sql` | `rollback/20261018_lock_communication_delivery_client_inserts_rollback.sql` |
| `20261019000000_materialize_user_stats.sql` | `rollback/20261019000000_materialize_user_stats_rollback.sql` |
| `20261019000001_fix_unique_active_booking_constraint.sql` | `rollback/20261019000001_fix_unique_active_booking_constraint_rollback.sql` |
| `20261019000002_ledger_wallet_balance.sql` | `rollback/20261019000002_ledger_wallet_balance_rollback.sql` |
| `20261028000000_close_wallet_pin_hash_client_access.sql` | `rollback/20261028000000_close_wallet_pin_hash_client_access_rollback.sql` |
| `20261101000000_trips_column_normalization.sql` | `rollback/20261101000000_trips_column_normalization_rollback.sql` |
| `20261101000001_ledger_drift_alert_and_schema_health.sql` | `rollback/20261101000001_ledger_drift_alert_and_schema_health_rollback.sql` |
| `20261102000000_schema_hygiene_completeness.sql` | `rollback/20261102000000_schema_hygiene_completeness_rollback.sql` |
| `20261107231309_align_chat_runtime_contract.sql` | `rollback/20261107231309_align_chat_runtime_contract_rollback.sql` |

---

## Applying migrations safely

There is no valid production cutover sequence documented yet. First reconcile local
and remote migration versions, resolve the duplicate `20261018000000` prefix, review
every local-only migration against the current remote schema, and test the ordered
result on a disposable project restored from a production backup. Only then prepare
a separate reviewed deployment plan. `supabase db push` is deliberately not part of
this development task.

Migration `20261108025826_harden_supabase_admin_default_privileges.sql` is prepared
but not applied. It changes defaults for objects created by `supabase_admin`, so it
must be applied by a role authorized to alter that role's default privileges. Apply
it only after the migration-history reconciliation above; it revokes implicit
`anon`/`authenticated` access to future tables, sequences, and functions, plus the
global default `PUBLIC` function execution grant. Existing object grants are
unchanged and required access must be granted explicitly.

### Post-migration validation

```sql
-- 1. Run the production readiness audit (read-only).
--    Expected: zero HIGH rows.
\i supabase/ops/production-readiness-audit.sql

-- 2. Run the client privilege probe (read-only).
--    Expected: zero rows on queries 2, 4, 5.
\i supabase/ops/audit_client_privileges.sql

-- 3. Verify all SECURITY DEFINER functions have search_path pinned.
SELECT p.oid::regprocedure AS function
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND NOT EXISTS (
    SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}'::text[])) cfg
    WHERE cfg LIKE 'search_path=%'
  );
-- Expected: zero rows.

-- 4. Verify all views are SECURITY INVOKER.
SELECT relname AS view_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
  AND NOT COALESCE(c.reloptions::text, '') LIKE '%security_invoker=true%';
-- Expected: only views that are intentionally owner-rights (document each one).

-- 5. Verify no table in public has RLS disabled.
SELECT relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
-- Expected: zero rows.

-- 6. Verify wallet ledger integrity.
SELECT * FROM public.reconcile_wallet_balances(false);
-- Expected: zero rows (no drift).

-- 7. Check schema health view.
SELECT * FROM public.v_schema_health ORDER BY status DESC;
-- Expected: all rows show status = 'ok' or 'unknown' (never 'alert' or 'stale').
```

---

## Schema Design Notes

- The `trips` table previously carried three overlapping coordinate column sets accumulated across migration passes. Migration `20261101000000` dropped the redundant alias columns (`origin_lat/lng`, `destination_lat/lng`, `origin`, `destination`). The canonical columns are `from_lat/from_lng`, `to_lat/to_lng`, and the derived GEOGRAPHY columns `from_location_geom`/`to_location_geom` kept in sync by `trg_sync_trip_geography`.
- `GRANT` statements are explicit per-table (enforced by `20261101000000`). The broad `GRANT … ON ALL TABLES IN SCHEMA public TO authenticated` has been revoked. New tables are denied to `authenticated` by default (fail-closed) until an explicit grant is added.
- All `SECURITY DEFINER` functions must include `SET search_path = public, pg_temp` as a function attribute (not inside the body). This is enforced by `20261102000000` and verified by the post-migration query above.
- All views that expose user data must be created with `WITH (security_invoker = true)` so RLS applies to the calling role, not the view owner.
- All `updated_at` triggers use a single `update_updated_at_column()` function — no duplicate definitions.
- Future migrations must use full `YYYYMMDDHHMMSS` timestamps and must never reuse an existing prefix.

---

## How to Apply a New Migration

```bash
supabase db push
```

Or manually:

```bash
psql "$SUPABASE_DB_URL" -f migrations/20261101000000_my_change.sql
```

## Seed Packs

Mock engine seed assets live in `supabase/seeds/`.

- `mock_engine_launch_pack.sql`
- `mock_engine_smoke_checks.sql`

---

## Reference Schema Files

| File | Purpose |
|------|---------|
| `schema.sql` | Full current schema snapshot for reference only — not applied by the CLI |
| `ai_schema.sql` | AI and intelligence layer schema reference |
| `supabase/ops/production-readiness-audit.sql` | Read-only security audit — run against production before any release |
| `supabase/ops/audit_client_privileges.sql` | Read-only client privilege probe — run against production after any grant change |

---

## Rollback Policy

Supabase does not support automatic rollbacks. Before any destructive migration:

1. Take a manual backup from the Supabase dashboard.
2. Prepare and test the compensating rollback script.
3. Keep the rollback script ready before production rollout.
4. Execute rollbacks in **reverse order** of the forward migrations.

See `ROLLBACK_STRATEGY.md` for the full dependency graph and risk assessments.
