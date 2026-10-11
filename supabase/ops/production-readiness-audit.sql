-- =============================================================================
-- Wasel production readiness audit (READ-ONLY)
--
-- Paste each part into Supabase Dashboard -> SQL Editor and run it against the
-- PRODUCTION project. Every statement is a SELECT; nothing is modified.
--
-- This complements migrations/verify_database.sql, which checks that schema
-- objects exist. This file checks the things that decide whether production data
-- is safe: row level security, anon privileges, SECURITY DEFINER hygiene, leftover
-- test fixtures and migration history.
--
-- How to read the result: Part A returns one row per finding. HIGH rows should be
-- fixed before launch. An empty Part A result (apart from INFO rows) is the goal.
-- Part A only reads system catalogs, so it runs on any schema version.
-- =============================================================================


-- =============================================================================
-- PART A: security findings (catalog-only; safe on any schema)
-- =============================================================================
select 'RLS disabled' as check_name, 'HIGH' as severity,
       c.relname::text as object,
       'table in public has row level security disabled' as detail
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity

union all
select 'RLS enabled, no policies', 'INFO', c.relname::text,
       'only service_role can read or write; confirm that is intended'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid)

union all
select 'Policy open to anon/public', 'MEDIUM',
       format('%I.%I', schemaname, tablename),
       format('policy "%s" (%s) applies to %s', policyname, cmd, roles::text)
from pg_policies
where schemaname = 'public' and roles && array['anon', 'public']::name[]

union all
select 'Anon has write grant', 'HIGH', table_name::text, privilege_type::text
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')

union all
select 'SECURITY DEFINER without search_path', 'HIGH', p.oid::regprocedure::text,
       'add: set search_path = public, pg_temp (prevents search-path hijacking)'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (
    select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg where cfg like 'search_path=%'
  )

union all
select 'SECURITY DEFINER callable by anon', 'HIGH', p.oid::regprocedure::text,
       'revoke execute from anon/public unless this is an intentionally public RPC'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')

union all
select 'Public storage bucket', 'MEDIUM', id::text,
       'bucket is publicly readable; confirm it holds nothing private'
from storage.buckets
where public

order by 2, 1, 3;


-- =============================================================================
-- PART B: leftover test fixtures (run each separately; a "relation does not
-- exist" error just means that table is named differently in your schema)
-- =============================================================================

-- B1. The payment-lifecycle seed migration (20260710000000_payment_lifecycle_seed_data.sql)
--     has no environment guard, so it runs in production. If this returns a row,
--     a test user exists in production.
select id, email, full_name, role, created_at
from public.users
where id = '00000000-0000-0000-0000-000000000001'::uuid
   or email ilike 'test+%@wasel14.online';

-- B2. Fixtures linked to that user (review before deleting anything).
select 'booking' as kind, id::text from public.bookings
  where id = '00000000-0000-0000-0000-000000000002'::uuid
union all
select 'payment', id::text from public.payments where id = 'pi_test_seed_0001'
union all
select 'wallet', user_id::text from public.wallets
  where user_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- B3. Anonymous users (anonymous sign-ins are disabled in config.toml, so this
--     should be 0, or only users created before it was turned off).
select count(*) filter (where is_anonymous) as anonymous_users, count(*) as all_users
from auth.users;


-- =============================================================================
-- PART C: migration history and worker health
-- =============================================================================

-- C1. Versions applied to production. Compare against `supabase migration list`
--     and the files in supabase/migrations. Two local files share the version
--     20260710000000, which the CLI cannot apply together, so at least one of
--     them is probably missing here.
select version, name
from supabase_migrations.schema_migrations
order by version desc;

-- C2. Event outbox and dead-letter volume (approximate row counts).
select relname as table_name, n_live_tup as approx_rows
from pg_stat_user_tables
where relname in ('event_outbox', 'dead_letter_messages');

-- C3. Extensions the app depends on.
select extname, extversion
from pg_extension
where extname in ('postgis', 'pg_trgm', 'pgcrypto', 'pg_cron', 'pg_net')
order by extname;
