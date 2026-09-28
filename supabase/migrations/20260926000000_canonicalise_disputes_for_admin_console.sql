-- ─────────────────────────────────────────────────────────────────────────────
-- Canonicalise `public.disputes` for the admin console
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Problem
--   `disputes` was created in 20260224000002 against the pre-cutover world:
--     complainant_id / respondent_id / resolved_by -> public.profiles(id)
--     trip_id                                       -> public.trips(id)
--   Everything it pointed at has since moved:
--     * public.profiles was archived and dropped CASCADE (20260512000000),
--       so those three constraints were destroyed along with it.
--     * public.trips was renamed to legacy_catalog_trips (20260326) and
--       rebuilt with `trip_id` as its primary key (20260327). The trip_id
--       constraint followed the rename, so it now points at the dead legacy
--       catalog and would reject any insert carrying a real trip id.
--   The table was also created without RLS, so it is exposed through the
--   Supabase REST API to every role holding the default table grants — while
--   dispute rows carry free-text descriptions and party identifiers.
--
-- Fix
--   Recreate the table if it is somehow absent, re-point the foreign keys at
--   the canonical public.users / public.trips, and lock the table down to the
--   service role (which is how the admin edge handler reads and resolves it).
--
-- Why NOT VALID
--   Any pre-existing complainant_id / respondent_id / trip_id values are
--   orphans left behind when public.profiles and the old public.trips went
--   away. A plain ADD CONSTRAINT would validate those rows and abort the
--   migration. NOT VALID skips the historical scan while still enforcing the
--   constraint on every new and updated row, which is what we want: the old
--   ids stay readable, nothing new can dangle. Backfill or purge them
--   separately if the historical rows ever need to be trustworthy.
--
-- Note on RLS
--   No SELECT policy is created, so authenticated clients can no longer read
--   disputes directly. That is deliberate — nothing in the product reads this
--   table outside the admin console. If a user-facing "my disputes" view is
--   ever added it must ship an explicit policy scoped to the complainant
--   rather than a blanket grant.

-- 1. Ensure the table exists with the canonical shape.
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid null,
  complainant_id uuid null,
  respondent_id uuid null,
  type text not null,
  description text not null,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'investigating', 'resolved', 'closed')),
  resolution text null,
  resolved_at timestamptz null,
  resolved_by uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 2. Drop whatever foreign keys are still hanging off the old schema.
do $$
declare
  v_constraint record;
begin
  if to_regclass('public.disputes') is null then
    return;
  end if;

  for v_constraint in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.disputes'::regclass
      and c.contype = 'f'
      and c.conname in (
        'disputes_trip_id_fkey',
        'disputes_complainant_id_fkey',
        'disputes_respondent_id_fkey',
        'disputes_resolved_by_fkey'
      )
  loop
    execute format('alter table public.disputes drop constraint %I', v_constraint.conname);
  end loop;
end $$;

-- 3. Re-point them at the canonical tables, only where the target exists.
do $$
begin
  if to_regclass('public.disputes') is null then
    return;
  end if;

  if to_regclass('public.users') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'users' and column_name = 'id'
     ) then
    alter table public.disputes
      add constraint disputes_complainant_id_fkey
      foreign key (complainant_id) references public.users(id) on delete set null not valid;

    alter table public.disputes
      add constraint disputes_respondent_id_fkey
      foreign key (respondent_id) references public.users(id) on delete set null not valid;

    alter table public.disputes
      add constraint disputes_resolved_by_fkey
      foreign key (resolved_by) references public.users(id) on delete set null not valid;
  end if;

  if to_regclass('public.trips') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'trips' and column_name = 'trip_id'
     ) then
    alter table public.disputes
      add constraint disputes_trip_id_fkey
      foreign key (trip_id) references public.trips(trip_id) on delete set null not valid;
  end if;
end $$;

-- 4. Lock the table down. The service role bypasses RLS, which is exactly how
--    the admin edge handler (make-server-0b1f4071/_handlers/admin.ts) uses it.
alter table public.disputes enable row level security;

-- 5. Support the admin list query: newest-first paging plus a status filter.
create index if not exists idx_disputes_created_at
  on public.disputes(created_at desc);

create index if not exists idx_disputes_status_created_at
  on public.disputes(status, created_at desc);

-- 6. Bounded revenue aggregate for the admin dashboard.
--    Summing in the edge function would mean reading every posted transaction
--    row in the window and reducing it client-side. This does the reduction
--    in the database and returns a single row.
do $$
begin
  if to_regclass('public.transactions') is null then
    return;
  end if;

  execute $fn$
    create or replace function public.admin_revenue_since(since timestamptz)
    returns numeric
    language sql
    stable
    security definer
    set search_path = public, pg_temp
    as $body$
      select coalesce(sum(amount), 0)
      from public.transactions
      where transaction_status = 'posted'
        and transaction_type in ('ride_payment', 'package_payment')
        and created_at >= since
    $body$
  $fn$;

  -- Service role only: this is an aggregate over all users' revenue.
  execute 'revoke all on function public.admin_revenue_since(timestamptz) from public, anon, authenticated';
  execute 'grant execute on function public.admin_revenue_since(timestamptz) to service_role';
end $$;
