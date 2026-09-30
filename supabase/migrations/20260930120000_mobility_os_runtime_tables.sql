-- Backs GET /mobility-os/public-snapshot and GET /mobility-os/snapshot.
--
-- The edge function previously assumed public.mobility_corridors already
-- existed and only attempted to seed rows. Because the create-table DDL was
-- never applied, the seed insert failed and the handler returned 500 with
-- "Could not find the table 'public.mobility_corridors' in the schema cache".
-- This migration is the schema source of truth for those routes; the runtime
-- DDL in _shared/mobility-os-runtime.ts is kept in sync for local execution.

create table if not exists public.mobility_corridors (
  id text primary key,
  origin text not null,
  destination text not null,
  distance_km numeric(10,2) not null check (distance_km >= 0),
  travel_time_min integer not null check (travel_time_min >= 0),
  seats_total integer not null check (seats_total >= 0),
  seats_booked integer not null default 0 check (seats_booked >= 0),
  cargo_total_kg numeric(10,2) not null check (cargo_total_kg >= 0),
  cargo_booked_kg numeric(10,2) not null default 0 check (cargo_booked_kg >= 0),
  base_price_seat numeric(10,2) not null check (base_price_seat >= 0),
  base_price_kg numeric(10,2) not null check (base_price_kg >= 0),
  demand_index numeric(10,4) not null default 0.30 check (demand_index >= 0),
  demand_history jsonb not null default '[]'::jsonb,
  price_history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.mobility_bookings (
  booking_id uuid primary key default gen_random_uuid(),
  corridor_id text not null references public.mobility_corridors(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  type text not null check (type in ('seat', 'cargo')),
  quantity numeric(10,2) not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  booking_timestamp timestamptz not null,
  trace_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_mobility_bookings_corridor_created
  on public.mobility_bookings (corridor_id, created_at desc);

create index if not exists idx_mobility_corridors_demand
  on public.mobility_corridors (demand_index desc);

alter table public.mobility_corridors enable row level security;
alter table public.mobility_bookings enable row level security;

drop policy if exists mobility_corridors_authenticated_select on public.mobility_corridors;
create policy mobility_corridors_authenticated_select
  on public.mobility_corridors
  for select
  to authenticated
  using (true);

drop policy if exists mobility_corridors_anon_select on public.mobility_corridors;
create policy mobility_corridors_anon_select
  on public.mobility_corridors
  for select
  to anon
  using (true);

drop policy if exists mobility_bookings_owner_select on public.mobility_bookings;
create policy mobility_bookings_owner_select
  on public.mobility_bookings
  for select
  to authenticated
  using (
    user_id in (
      select id
      from public.users
      where auth_user_id::text = auth.uid()::text
    )
  );

revoke all on table public.mobility_corridors from public, anon;
revoke all on table public.mobility_bookings from public, anon;
grant select on table public.mobility_corridors to anon, authenticated;
grant select, insert, update on table public.mobility_bookings to authenticated;
grant select, insert, update, delete on table public.mobility_corridors to service_role;
grant select, insert, update, delete on table public.mobility_bookings to service_role;

-- Seed the initial corridor set used by the public snapshot. on conflict do
-- nothing keeps this safe to re-run against an already seeded database.
insert into public.mobility_corridors (
  id, origin, destination, distance_km, travel_time_min,
  seats_total, seats_booked, cargo_total_kg, cargo_booked_kg,
  base_price_seat, base_price_kg, demand_index, demand_history, price_history
)
values
  ('amman-irbid', 'Amman', 'Irbid', 104, 90, 44, 29, 160, 104, 4.80, 0.42, 0.93, '[0.74,0.82,0.88,0.91,0.93]'::jsonb, '[5.12,5.34,5.62,5.89,6.02]'::jsonb),
  ('amman-zarqa', 'Amman', 'Zarqa', 22, 30, 58, 21, 210, 88, 2.40, 0.28, 0.52, '[0.38,0.44,0.47,0.50,0.52]'::jsonb, '[2.52,2.54,2.60,2.62,2.66]'::jsonb),
  ('amman-aqaba', 'Amman', 'Aqaba', 330, 240, 36, 28, 240, 150, 9.60, 0.68, 1.08, '[0.86,0.94,1.01,1.04,1.08]'::jsonb, '[10.84,11.18,11.54,11.88,12.12]'::jsonb),
  ('amman-karak', 'Amman', 'Karak', 140, 120, 40, 17, 170, 61, 5.60, 0.50, 0.57, '[0.41,0.46,0.50,0.54,0.57]'::jsonb, '[5.80,5.96,6.04,6.10,6.14]'::jsonb),
  ('irbid-zarqa', 'Irbid', 'Zarqa', 79, 67, 32, 12, 120, 40, 3.30, 0.31, 0.48, '[0.29,0.33,0.40,0.44,0.48]'::jsonb, '[3.40,3.46,3.50,3.52,3.58]'::jsonb),
  ('madaba-amman', 'Madaba', 'Amman', 33, 34, 28, 9, 90, 18, 2.10, 0.24, 0.40, '[0.24,0.28,0.31,0.36,0.40]'::jsonb, '[2.18,2.22,2.24,2.28,2.30]'::jsonb)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
