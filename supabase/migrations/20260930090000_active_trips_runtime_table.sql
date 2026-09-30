-- Backs the frontend `active-trip` route (GET/POST/PATCH/DELETE).
--
-- The Dashboard banner and LiveTripTracking both need to know which ride is
-- currently in progress, and that has to survive a page reload, so it cannot
-- live in localStorage or in-memory state. One row per user, keyed by user_id:
-- starting a new ride replaces the row (upsert) and DELETE clears it.
--
-- The fields the dashboard renders (driver, vehicle, from/to) are stored as a
-- jsonb `payload` because they are read and written as one opaque blob by the
-- client. The columns that the server filters or orders on — status, share_code,
-- started_at — are promoted out of the payload so PATCH stays a partial update
-- and status stays queryable.

create table if not exists public.active_trips (
  user_id uuid primary key references public.users(id) on delete cascade,
  trip_id uuid,
  booking_id uuid,
  share_code text,
  status text not null default 'en_route_to_pickup'
    check (status in ('en_route_to_pickup', 'driver_arrived', 'en_route', 'arriving', 'completed')),
  eta text,
  price numeric,
  passengers integer,
  tier text,
  payload jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_active_trips_trip_id
  on public.active_trips (trip_id);

create index if not exists idx_active_trips_status
  on public.active_trips (status);

alter table public.active_trips enable row level security;

DROP POLICY IF EXISTS active_trips_select_own ON public.active_trips;
CREATE POLICY active_trips_select_own ON public.active_trips
  for select
  to authenticated
  using (user_id in (select id from public.users where auth_user_id::text = auth.uid()::text));

DROP POLICY IF EXISTS active_trips_insert_own ON public.active_trips;
CREATE POLICY active_trips_insert_own ON public.active_trips
  for insert
  to authenticated
  with check (user_id in (select id from public.users where auth_user_id::text = auth.uid()::text));

DROP POLICY IF EXISTS active_trips_update_own ON public.active_trips;
CREATE POLICY active_trips_update_own ON public.active_trips
  for update
  to authenticated
  using (user_id in (select id from public.users where auth_user_id::text = auth.uid()::text))
  with check (user_id in (select id from public.users where auth_user_id::text = auth.uid()::text));

DROP POLICY IF EXISTS active_trips_delete_own ON public.active_trips;
CREATE POLICY active_trips_delete_own ON public.active_trips
  for delete
  to authenticated
  using (user_id in (select id from public.users where auth_user_id::text = auth.uid()::text));

revoke all on table public.active_trips from public, anon;
grant select, insert, update, delete on table public.active_trips to authenticated;
grant select, insert, update, delete on table public.active_trips to service_role;

notify pgrst, 'reload schema';