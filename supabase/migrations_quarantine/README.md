# migrations_quarantine

Files here are NOT applied by `supabase db push` (the CLI only reads `supabase/migrations/*.sql`).

## 20261017000000_rls_price_and_view_hardening.sql
Moved out of `supabase/migrations/` on 2026-10-18. Its own header says it must not be pushed to
production as written: it targets the legacy local schema (`profiles`, `kv_store_0b1f4071`,
`trips.id`, `v_user_bookings`). On production the `guard_booking_pricing` trigger would raise
`column t.id does not exist` on every booking insert, and `.github/workflows/deploy.yml` runs
`supabase db push` automatically on every push to main/master.

To bring it back: run `supabase db pull`, rewrite sections 1-3 against the real schema (`trips.trip_id`,
no `profiles`), test on a staging project, then move it back into `supabase/migrations/` with a
fresh timestamp. Rollback companion: `supabase/migrations/rollback/20261017_rls_price_and_view_hardening_rollback.sql`.
