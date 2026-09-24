-- Align canonical RLS policies with the app-facing direct Supabase contract.
-- This migration replaces broad FOR ALL policies with explicit SELECT/INSERT/
-- UPDATE/DELETE policies so fallback writes match the canonical schema.

drop policy if exists users_self_or_admin_select on public.users;
drop policy if exists users_self_or_admin_insert on public.users;
drop policy if exists users_self_or_admin_update on public.users;
DROP POLICY IF EXISTS users_self_or_admin_select ON public.users;
CREATE POLICY users_self_or_admin_select ON public.users
for select using (
  auth_user_id = auth.uid()
  or id = public.current_user_id()
  or public.is_admin()
);
DROP POLICY IF EXISTS users_self_or_admin_insert ON public.users;
CREATE POLICY users_self_or_admin_insert ON public.users
for insert with check (
  public.is_admin()
  or (
    auth.uid() is not null
    and auth_user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS users_self_or_admin_update ON public.users;
CREATE POLICY users_self_or_admin_update ON public.users
for update using (
  auth_user_id = auth.uid()
  or id = public.current_user_id()
  or public.is_admin()
)
with check (
  auth_user_id = auth.uid()
  or id = public.current_user_id()
  or public.is_admin()
);
DROP POLICY IF EXISTS users_admin_delete ON public.users;
CREATE POLICY users_admin_delete ON public.users
for delete using (public.is_admin());

drop policy if exists drivers_self_or_admin_select on public.drivers;
drop policy if exists drivers_self_or_admin_insert on public.drivers;
drop policy if exists drivers_self_or_admin_update on public.drivers;
DROP POLICY IF EXISTS drivers_self_or_admin_select ON public.drivers;
CREATE POLICY drivers_self_or_admin_select ON public.drivers
for select using (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS drivers_self_or_admin_insert ON public.drivers;
CREATE POLICY drivers_self_or_admin_insert ON public.drivers
for insert with check (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS drivers_self_or_admin_update ON public.drivers;
CREATE POLICY drivers_self_or_admin_update ON public.drivers
for update using (user_id = public.current_user_id() or public.is_admin())
with check (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS drivers_admin_delete ON public.drivers;
CREATE POLICY drivers_admin_delete ON public.drivers
for delete using (public.is_admin());

drop policy if exists vehicles_driver_or_admin_access on public.vehicles;
drop policy if exists vehicles_driver_or_admin_select on public.vehicles;
drop policy if exists vehicles_driver_or_admin_insert on public.vehicles;
drop policy if exists vehicles_driver_or_admin_update on public.vehicles;
DROP POLICY IF EXISTS vehicles_driver_or_admin_select ON public.vehicles;
CREATE POLICY vehicles_driver_or_admin_select ON public.vehicles
for select using (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = vehicles.driver_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS vehicles_driver_or_admin_insert ON public.vehicles;
CREATE POLICY vehicles_driver_or_admin_insert ON public.vehicles
for insert with check (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = vehicles.driver_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS vehicles_driver_or_admin_update ON public.vehicles;
CREATE POLICY vehicles_driver_or_admin_update ON public.vehicles
for update using (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = vehicles.driver_id
      and d.user_id = public.current_user_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = vehicles.driver_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS vehicles_admin_delete ON public.vehicles;
CREATE POLICY vehicles_admin_delete ON public.vehicles
for delete using (public.is_admin());

drop policy if exists trips_public_open_select on public.trips;
drop policy if exists trips_driver_or_admin_write on public.trips;
drop policy if exists trips_driver_or_admin_insert on public.trips;
drop policy if exists trips_driver_or_admin_update on public.trips;
DROP POLICY IF EXISTS trips_public_open_select ON public.trips;
CREATE POLICY trips_public_open_select ON public.trips
for select using (
  trip_status in ('open', 'booked', 'in_progress')
  or public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = trips.driver_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS trips_driver_or_admin_insert ON public.trips;
CREATE POLICY trips_driver_or_admin_insert ON public.trips
for insert with check (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = trips.driver_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS trips_driver_or_admin_update ON public.trips;
CREATE POLICY trips_driver_or_admin_update ON public.trips
for update using (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = trips.driver_id
      and d.user_id = public.current_user_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = trips.driver_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS trips_driver_or_admin_delete ON public.trips;
CREATE POLICY trips_driver_or_admin_delete ON public.trips
for delete using (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = trips.driver_id
      and d.user_id = public.current_user_id()
  )
);

drop policy if exists bookings_owner_driver_admin_access on public.bookings;
drop policy if exists bookings_owner_driver_admin_select on public.bookings;
drop policy if exists bookings_owner_insert on public.bookings;
drop policy if exists bookings_owner_driver_admin_update on public.bookings;
DROP POLICY IF EXISTS bookings_owner_driver_admin_select ON public.bookings;
CREATE POLICY bookings_owner_driver_admin_select ON public.bookings
for select using (
  passenger_id = public.current_user_id()
  or public.is_admin()
  or exists (
    select 1
    from public.trips t
    join public.drivers d on d.driver_id = t.driver_id
    where t.trip_id = bookings.trip_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS bookings_owner_insert ON public.bookings;
CREATE POLICY bookings_owner_insert ON public.bookings
for insert with check (
  passenger_id = public.current_user_id()
  or public.is_admin()
);
DROP POLICY IF EXISTS bookings_owner_driver_admin_update ON public.bookings;
CREATE POLICY bookings_owner_driver_admin_update ON public.bookings
for update using (
  passenger_id = public.current_user_id()
  or public.is_admin()
  or exists (
    select 1
    from public.trips t
    join public.drivers d on d.driver_id = t.driver_id
    where t.trip_id = bookings.trip_id
      and d.user_id = public.current_user_id()
  )
)
with check (
  passenger_id = public.current_user_id()
  or public.is_admin()
  or exists (
    select 1
    from public.trips t
    join public.drivers d on d.driver_id = t.driver_id
    where t.trip_id = bookings.trip_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS bookings_owner_admin_delete ON public.bookings;
CREATE POLICY bookings_owner_admin_delete ON public.bookings
for delete using (
  passenger_id = public.current_user_id()
  or public.is_admin()
);

drop policy if exists packages_sender_driver_admin_access on public.packages;
drop policy if exists packages_sender_driver_admin_select on public.packages;
drop policy if exists packages_sender_insert on public.packages;
drop policy if exists packages_sender_driver_admin_update on public.packages;
DROP POLICY IF EXISTS packages_sender_driver_admin_select ON public.packages;
CREATE POLICY packages_sender_driver_admin_select ON public.packages
for select using (
  sender_id = public.current_user_id()
  or receiver_id = public.current_user_id()
  or public.is_admin()
  or exists (
    select 1
    from public.trips t
    join public.drivers d on d.driver_id = t.driver_id
    where t.trip_id = packages.trip_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS packages_sender_insert ON public.packages;
CREATE POLICY packages_sender_insert ON public.packages
for insert with check (
  sender_id = public.current_user_id()
  or public.is_admin()
);
DROP POLICY IF EXISTS packages_sender_driver_admin_update ON public.packages;
CREATE POLICY packages_sender_driver_admin_update ON public.packages
for update using (
  sender_id = public.current_user_id()
  or receiver_id = public.current_user_id()
  or public.is_admin()
  or exists (
    select 1
    from public.trips t
    join public.drivers d on d.driver_id = t.driver_id
    where t.trip_id = packages.trip_id
      and d.user_id = public.current_user_id()
  )
)
with check (
  sender_id = public.current_user_id()
  or receiver_id = public.current_user_id()
  or public.is_admin()
  or exists (
    select 1
    from public.trips t
    join public.drivers d on d.driver_id = t.driver_id
    where t.trip_id = packages.trip_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS packages_sender_admin_delete ON public.packages;
CREATE POLICY packages_sender_admin_delete ON public.packages
for delete using (
  sender_id = public.current_user_id()
  or public.is_admin()
);

drop policy if exists wallets_owner_admin_access on public.wallets;
DROP POLICY IF EXISTS wallets_owner_admin_select ON public.wallets;
CREATE POLICY wallets_owner_admin_select ON public.wallets
for select using (user_id = public.current_user_id() or public.is_admin());

drop policy if exists transactions_owner_admin_access on public.transactions;
DROP POLICY IF EXISTS transactions_owner_admin_select ON public.transactions;
CREATE POLICY transactions_owner_admin_select ON public.transactions
for select using (
  public.is_admin()
  or exists (
    select 1 from public.wallets w
    where w.wallet_id = transactions.wallet_id
      and w.user_id = public.current_user_id()
  )
);

drop policy if exists verification_self_admin_access on public.verification_records;
drop policy if exists verification_self_admin_select on public.verification_records;
drop policy if exists verification_self_admin_insert on public.verification_records;
drop policy if exists verification_admin_update on public.verification_records;
DROP POLICY IF EXISTS verification_self_admin_select ON public.verification_records;
CREATE POLICY verification_self_admin_select ON public.verification_records
for select using (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS verification_self_admin_insert ON public.verification_records;
CREATE POLICY verification_self_admin_insert ON public.verification_records
for insert with check (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS verification_admin_update ON public.verification_records;
CREATE POLICY verification_admin_update ON public.verification_records
for update using (public.is_admin())
with check (public.is_admin());
DROP POLICY IF EXISTS verification_admin_delete ON public.verification_records;
CREATE POLICY verification_admin_delete ON public.verification_records
for delete using (public.is_admin());

drop policy if exists admin_logs_admin_only on public.admin_logs;
DROP POLICY IF EXISTS admin_logs_admin_only ON public.admin_logs;
CREATE POLICY admin_logs_admin_only ON public.admin_logs
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists otp_owner_admin_access on public.otp_sessions;
drop policy if exists otp_owner_admin_select on public.otp_sessions;
drop policy if exists otp_owner_admin_insert on public.otp_sessions;
DROP POLICY IF EXISTS otp_owner_admin_select ON public.otp_sessions;
CREATE POLICY otp_owner_admin_select ON public.otp_sessions
for select using (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS otp_owner_admin_insert ON public.otp_sessions;
CREATE POLICY otp_owner_admin_insert ON public.otp_sessions
for insert with check (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS otp_admin_update ON public.otp_sessions;
CREATE POLICY otp_admin_update ON public.otp_sessions
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists payment_methods_owner_admin_access on public.payment_methods;
drop policy if exists payment_methods_owner_admin_select on public.payment_methods;
drop policy if exists payment_methods_owner_admin_insert on public.payment_methods;
drop policy if exists payment_methods_owner_admin_update on public.payment_methods;
DROP POLICY IF EXISTS payment_methods_owner_admin_select ON public.payment_methods;
CREATE POLICY payment_methods_owner_admin_select ON public.payment_methods
for select using (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS payment_methods_owner_admin_insert ON public.payment_methods;
CREATE POLICY payment_methods_owner_admin_insert ON public.payment_methods
for insert with check (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS payment_methods_owner_admin_update ON public.payment_methods;
CREATE POLICY payment_methods_owner_admin_update ON public.payment_methods
for update using (user_id = public.current_user_id() or public.is_admin())
with check (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS payment_methods_owner_admin_delete ON public.payment_methods;
CREATE POLICY payment_methods_owner_admin_delete ON public.payment_methods
for delete using (user_id = public.current_user_id() or public.is_admin());

drop policy if exists package_events_access on public.package_events;
DROP POLICY IF EXISTS package_events_access ON public.package_events;
CREATE POLICY package_events_access ON public.package_events
for select using (
  public.is_admin()
  or exists (
    select 1 from public.packages p
    where p.package_id = package_events.package_id
      and (p.sender_id = public.current_user_id() or p.receiver_id = public.current_user_id())
  )
);
DROP POLICY IF EXISTS package_events_driver_admin_insert ON public.package_events;
CREATE POLICY package_events_driver_admin_insert ON public.package_events
for insert with check (
  public.is_admin()
  or created_by = public.current_user_id()
);

drop policy if exists trip_presence_driver_admin_access on public.trip_presence;
drop policy if exists trip_presence_driver_admin_select on public.trip_presence;
drop policy if exists trip_presence_driver_admin_insert on public.trip_presence;
DROP POLICY IF EXISTS trip_presence_driver_admin_select ON public.trip_presence;
CREATE POLICY trip_presence_driver_admin_select ON public.trip_presence
for select using (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = trip_presence.driver_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS trip_presence_driver_admin_insert ON public.trip_presence;
CREATE POLICY trip_presence_driver_admin_insert ON public.trip_presence
for insert with check (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = trip_presence.driver_id
      and d.user_id = public.current_user_id()
  )
);
DROP POLICY IF EXISTS trip_presence_driver_admin_update ON public.trip_presence;
CREATE POLICY trip_presence_driver_admin_update ON public.trip_presence
for update using (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = trip_presence.driver_id
      and d.user_id = public.current_user_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.drivers d
    where d.driver_id = trip_presence.driver_id
      and d.user_id = public.current_user_id()
  )
);

-- Notifications comes from the earlier schema family but is still part of the
-- live backend contract used by the web app.
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_insert_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
for select using (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS notifications_insert_own ON public.notifications;
CREATE POLICY notifications_insert_own ON public.notifications
for insert with check (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
for update using (user_id = public.current_user_id() or public.is_admin())
with check (user_id = public.current_user_id() or public.is_admin());
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
for delete using (user_id = public.current_user_id() or public.is_admin());
