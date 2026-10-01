-- =====================================================
-- Wallet RPC owner enforcement and anon write lockdown
--
-- Audit findings addressed:
--   CRITICAL  app_add_wallet_funds / app_book_trip are SECURITY DEFINER, are
--             granted to `authenticated`, and contain no auth.uid() check, so
--             any signed-in user can credit an arbitrary wallet or debit an
--             arbitrary passenger's wallet by supplying their id.
--   CRITICAL  `anon` is only ever stripped of SELECT. INSERT/UPDATE/DELETE are
--             never revoked, so any table that lacks RLS is writable by an
--             unauthenticated caller.
--   HIGH      anonymize_user_data guards with `!=` against a nullable helper,
--             so a caller with no canonical users row skips the check entirely.
--   HIGH      25 tables were created without RLS, including a full PII archive.
-- =====================================================

-- ── 1. Lock `anon` out of every write path ──────────────────────────────────
-- Applied regardless of the project's baseline ACL so the result no longer
-- depends on whether the database was created with the Supabase default that
-- grants ALL to anon in public.
revoke insert, update, delete on all tables in schema public from anon;

alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from anon;

-- ── 2. Enable RLS on tables that never had it ───────────────────────────────
-- With RLS on and no policy, every non-service_role role is denied. That is
-- the correct posture for infrastructure logs, raw payment payloads, device
-- tokens and payout records, all of which are read only through the Edge
-- Function using service_role.
do $$
declare
  t text;
  unprotected text[] := array[
    'profiles_archive', 'driver_payouts', 'loyalty_points', 'loyalty_transactions',
    'student_verifications', 'processed_stripe_events', 'push_tokens', 'devices',
    'business_accounts', 'promo_codes', 'chat_media', 'campaigns', 'pricing_rules',
    'demand_forecasts', 'corridor_analytics', 'trip_analytics', 'analytics_events',
    'api_logs', 'error_logs', 'backup_logs', 'health_checks', 'system_alerts',
    'driver_status_history', 'typing_indicators', 'universities',
    'bus_operators', 'bus_routes', 'bus_schedules', 'bus_bookings',
    'organizations', 'organization_members', 'corporate_credits', 'invoices'
  ];
begin
  foreach t in array unprotected loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
    end if;
  end loop;
end $$;

-- ── 3. Remove blanket SELECT policies on private data ───────────────────────
-- These bound to PUBLIC because they carry no `TO` clause, which combined with
-- the anon grant on `reviews` exposed every review row to unauthenticated
-- callers. `reviews` is replaced with an owner-scoped policy below; the driver
-- tables keep RLS-with-no-policy, which denies rather than publishes.
drop policy if exists reviews_select_all on public.reviews;
drop policy if exists driver_locations_select_all on public.driver_locations;
drop policy if exists driver_profiles_select_all on public.driver_profiles;

create policy reviews_select_own on public.reviews
  for select to authenticated
  using (reviewee_id = public.current_user_id() or reviewer_id = public.current_user_id());

-- ── 4. Enforce the caller is the account owner on the wallet RPCs ───────────
-- `public.users.id` is a surrogate key; `auth.uid()` returns `auth.users.id`.
-- Comparing them directly is always false, which is why these guards are
-- written against current_user_id(), the helper that performs the mapping.
create or replace function public.app_add_wallet_funds(
  p_user_id uuid,
  p_amount numeric,
  p_payment_method payment_method_v2,
  p_external_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet_id uuid;
begin
  -- Only the payment webhook (service_role) may credit a wallet. A client may
  -- never name the wallet it is funding, and funding requires a verified
  -- provider event, not a request body.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Wallet funding is only permitted from a verified payment webhook'
      using errcode = '42501';
  end if;

  if not public.check_rate_limit(p_user_id, 'add_wallet_funds', 5, 15) then
    raise exception 'Too many wallet funding attempts. Please try again later.';
  end if;

  select wallet_id into v_wallet_id from public.wallets where user_id = p_user_id;
  if v_wallet_id is null then
    raise exception 'Wallet not found';
  end if;

  return public.wallet_post_transaction(
    v_wallet_id, p_amount, 'add_funds', p_payment_method, 'credit',
    'wallet', v_wallet_id, jsonb_build_object('external_reference', p_external_reference)
  );
end;
$$;

create or replace function public.app_book_trip(
  p_trip_id uuid,
  p_passenger_id uuid,
  p_seat_number integer,
  p_payment_method payment_method_v2 default 'wallet_balance'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip record;
  v_wallet_id uuid;
  v_booking_id uuid;
  v_transaction_id uuid;
  v_passenger_level verification_level_v2;
begin
  -- The fare is debited from the caller's own wallet, so the caller must be
  -- the passenger. Without this check any user could charge another rider.
  if coalesce(auth.role(), '') <> 'service_role'
     and (public.current_user_id() is null
          or public.current_user_id() is distinct from p_passenger_id) then
    raise exception 'Bookings must be made by the account owner'
      using errcode = '42501';
  end if;

  if not public.check_rate_limit(p_passenger_id, 'book_trip', 10, 15) then
    raise exception 'Too many booking attempts. Please try again later.';
  end if;

  select * into v_trip from public.trips where trip_id = p_trip_id for update;
  if not found then raise exception 'Trip not found'; end if;
  if v_trip.trip_status not in ('open', 'booked') then raise exception 'Trip is not open for booking'; end if;
  if v_trip.available_seats <= 0 then raise exception 'No seats available'; end if;

  select verification_level into v_passenger_level from public.users where id = p_passenger_id;
  if v_passenger_level is null or v_passenger_level = 'level_0' then
    raise exception 'Passenger must complete phone verification before booking';
  end if;

  select wallet_id into v_wallet_id from public.wallets where user_id = p_passenger_id;
  v_transaction_id := public.wallet_post_transaction(
    v_wallet_id, v_trip.price_per_seat, 'ride_payment', p_payment_method, 'debit',
    'trip', p_trip_id, jsonb_build_object('seat_number', p_seat_number)
  );

  insert into public.bookings (
    trip_id, passenger_id, seat_number, booking_status, amount, payment_transaction_id
  )
  values (
    p_trip_id, p_passenger_id, p_seat_number, 'confirmed', v_trip.price_per_seat, v_transaction_id
  )
  returning booking_id into v_booking_id;

  update public.trips
  set available_seats = available_seats - 1,
      trip_status = case when available_seats - 1 = 0 then 'booked' else trip_status end
  where trip_id = p_trip_id;

  return v_booking_id;
end;
$$;

-- ── 5. Fix the NULL-comparison bypass in anonymize_user_data ───────────────
-- `current_user_id() != p_user_id` evaluates to NULL when the caller has no
-- canonical users row, so `IF NULL` is not taken and the whole guard is skipped.
create or replace function public.anonymize_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if public.current_user_id() is distinct from p_user_id and not public.is_admin() then
    raise exception 'Access denied: cannot anonymize other users data' using errcode = '42501';
  end if;

  update public.users
  set email = null,
      phone_number = null,
      national_id = null,
      national_id_hash = null,
      national_id_last4 = null,
      date_of_birth = null,
      two_factor_secret = null,
      two_factor_backup_codes = null,
      deleted_at = now()
  where id = p_user_id;
end;
$$;

-- ── 6. Close the client-executable surface on money-moving RPCs ─────────────
-- Every one of these bypasses the Edge Function, and therefore bypasses the
-- amount caps, hourly rate limits and wallet PIN gate that the handler
-- enforces. Money must move only through service_role.
revoke execute on function public.app_add_wallet_funds(uuid, numeric, public.payment_method_v2, text)
  from public, anon, authenticated;
revoke execute on function public.app_book_trip(uuid, uuid, integer, public.payment_method_v2)
  from public, anon, authenticated;
revoke execute on function public.app_transfer_wallet_funds(uuid, uuid, numeric, public.payment_method_v2)
  from public, anon, authenticated;
revoke execute on function public.app_withdraw_wallet_funds(uuid, numeric, text, text)
  from public, anon, authenticated;
revoke execute on function public.app_pay_with_wallet(uuid, numeric, public.transaction_type_v2, public.payment_method_v2, text, uuid, jsonb)
  from public, anon, authenticated;

-- The remaining allowlisted functions are not money-moving, but these three
-- impersonate a caller or forge identity state and have no owner check.
revoke execute on function public.app_create_trip(uuid, text, text, timestamp with time zone, integer, numeric, boolean, integer)
  from public, anon, authenticated;
revoke execute on function public.app_assign_package_to_trip(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.app_submit_sanad_verification(uuid, text, text)
  from public, anon, authenticated;

-- ── 7. Booking creation: server-authoritative fare, locked seats ─────────────
-- `app_create_ride_booking` locks the trip row and is idempotent, but it
-- accepted `p_total_price` from the caller and compared `p_passenger_id`
-- against `auth.uid()`, which returns the auth.users id rather than the
-- public.users surrogate key, so the ownership check could never pass. The
-- fare is now derived from the locked trip row under the same identity helper
-- used everywhere else.
create or replace function public.app_create_ride_booking(
  p_trip_id         uuid,
  p_passenger_id    uuid,
  p_seats_requested int,
  p_pickup          text,
  p_dropoff         text,
  p_booking_status  text,
  p_total_price     numeric
) returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip        public.trips%rowtype;
  v_booking     public.bookings%rowtype;
  v_seat_number int;
  v_status      text;
  v_fare        numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null then
      raise exception 'Authentication required' using errcode = '42501';
    end if;
    if p_passenger_id is null or public.current_user_id() is distinct from p_passenger_id then
      raise exception 'Unauthorized: cannot create booking for another user'
        using errcode = '42501';
    end if;
  end if;

  if p_seats_requested < 1 or p_seats_requested > 8 then
    raise exception 'seats_requested must be between 1 and 8' using errcode = '22023';
  end if;

  if length(coalesce(p_pickup, '')) > 500 or length(coalesce(p_dropoff, '')) > 500 then
    raise exception 'location exceeds maximum length' using errcode = '22001';
  end if;

  if p_booking_status not in ('pending_driver', 'confirmed') then
    raise exception 'Invalid booking status: %', p_booking_status using errcode = '22023';
  end if;
  v_status := p_booking_status;

  -- Lock the trip first: this is what makes the seat count and the fare
  -- trustworthy, because both are read from the same locked row.
  select * into v_trip
  from public.trips
  where trip_id = p_trip_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Trip not found or has been deleted' using errcode = 'P0002';
  end if;

  if v_trip.trip_status not in ('open', 'pending') then
    raise exception 'Trip is no longer accepting bookings (status: %)', v_trip.trip_status
      using errcode = 'P0001';
  end if;

  if v_status = 'confirmed' and v_trip.available_seats < p_seats_requested then
    raise exception 'Not enough seats available (requested: %, available: %)',
      p_seats_requested, v_trip.available_seats using errcode = 'P0001';
  end if;

  -- The fare is computed here, not taken from the request. p_total_price is
  -- accepted only so existing callers keep their signature.
  v_fare := coalesce(v_trip.price_per_seat, 0) * p_seats_requested;
  if v_fare < 0 then
    raise exception 'Trip has no valid fare' using errcode = '22023';
  end if;

  -- Idempotency: a replay returns the existing booking with no side effects,
  -- so a double-tap or client retry cannot consume a second seat.
  select * into v_booking
  from public.bookings
  where trip_id = p_trip_id
    and passenger_id = p_passenger_id
    and booking_status not in ('cancelled', 'rejected');

  if found then
    return v_booking;
  end if;

  select coalesce(max(seat_number), 0) + 1 into v_seat_number
  from public.bookings
  where trip_id = p_trip_id
    and booking_status not in ('cancelled', 'rejected');

  insert into public.bookings (
    trip_id, passenger_id, seat_number,
    booking_status, status, confirmed_by_driver,
    amount, pickup_location, dropoff_location,
    seats_requested, total_price
  ) values (
    p_trip_id, p_passenger_id, v_seat_number,
    v_status, v_status, (v_status = 'confirmed'),
    v_fare, p_pickup, p_dropoff,
    p_seats_requested, v_fare
  )
  returning * into v_booking;

  if v_status = 'confirmed' then
    update public.trips
    set available_seats = available_seats - p_seats_requested,
        trip_status = case
          when available_seats - p_seats_requested <= 0 then 'booked'
          else trip_status
        end
    where trip_id = p_trip_id;
  end if;

  return v_booking;
end;
$$;

