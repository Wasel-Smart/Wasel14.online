-- Migration: 20261011000000_fix_ride_booking_service_role_and_fare.sql
--
-- Fixes two defects in public.app_create_ride_booking as last defined by
-- 20260711000001_hardened_ride_booking_functions.sql.
--
-- 1. Every booking made through the Edge Function was rejected.
--    The Edge Function calls this RPC with the service-role client. The function
--    required auth.uid() IS NOT NULL and p_passenger_id = auth.uid(), but a
--    service-role JWT carries no `sub` claim, so auth.uid() is NULL and the call
--    always raised 'Authentication required'. 20260720062017 also revoked
--    EXECUTE from `authenticated`, so the service role is the only caller.
--    The Edge Function has already authenticated the user and passes the
--    canonical id, so service_role is now accepted; any other caller must still
--    be the passenger themself.
--
-- 2. The fare was whatever the caller passed (the handler passes 0), so a booking
--    that did get through was created with amount = total_price = 0. The fare is
--    now derived from the locked trip row and p_total_price is ignored, which is
--    what the Edge Function's own comment already assumes.
--
-- Also: SET search_path was missing on a SECURITY DEFINER function, the idempotent
-- replay ran after the seat check (a retry on a full trip raised an error instead
-- of returning the existing booking), and a driver could book their own trip.
--
-- Signature and return type are unchanged, so CREATE OR REPLACE is safe to re-run.

create or replace function public.app_create_ride_booking(
  p_trip_id         uuid,
  p_passenger_id    uuid,
  p_seats_requested int,
  p_pickup          text,
  p_dropoff         text,
  p_booking_status  text,
  p_total_price     numeric   -- ignored: the fare is derived from the trip row
) returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trip        public.trips%rowtype;
  v_booking     public.bookings%rowtype;
  v_seat_number int;
  v_status      public.booking_status_enum;
  v_caller      uuid := auth.uid();
  v_is_service  boolean := coalesce(auth.role(), '') = 'service_role';
  v_unit_price  numeric;
  v_total       numeric;
begin
  -- 1. Caller identity. The trusted Edge Function (service_role) has already
  --    authenticated the user; any other caller must be the passenger.
  if p_passenger_id is null then
    raise exception 'passenger is required' using errcode = '22023';
  end if;
  if not v_is_service then
    if v_caller is null then
      raise exception 'Authentication required' using errcode = '42501';
    end if;
    if p_passenger_id <> v_caller then
      raise exception 'Unauthorized: cannot create booking for another user'
        using errcode = '42501';
    end if;
  end if;

  -- 2. Input validation
  if p_seats_requested is null or p_seats_requested < 1 or p_seats_requested > 8 then
    raise exception 'seats_requested must be between 1 and 8' using errcode = '22023';
  end if;
  if length(coalesce(p_pickup, '')) > 500 then
    raise exception 'pickup location exceeds maximum length' using errcode = '22001';
  end if;
  if length(coalesce(p_dropoff, '')) > 500 then
    raise exception 'dropoff location exceeds maximum length' using errcode = '22001';
  end if;

  begin
    v_status := p_booking_status::public.booking_status_enum;
  exception when invalid_text_representation then
    raise exception 'Invalid booking status: %', p_booking_status using errcode = '22023';
  end;
  if v_status not in ('pending_driver', 'confirmed') then
    raise exception 'New bookings must have status pending_driver or confirmed'
      using errcode = '22023';
  end if;

  -- 3. Lock the trip row so concurrent requests cannot both take the last seat.
  select * into v_trip
  from public.trips
  where trip_id = p_trip_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Trip not found or has been deleted' using errcode = 'P0002';
  end if;

  -- 4. Idempotent replay: return the existing live booking before any seat or
  --    status check, so a client retry never turns into an error.
  select * into v_booking
  from public.bookings
  where trip_id = p_trip_id
    and passenger_id = p_passenger_id
    and booking_status not in ('cancelled', 'rejected');

  if found then
    return v_booking;
  end if;

  if v_trip.trip_status not in ('open', 'pending') then
    raise exception 'Trip is no longer accepting bookings (status: %)', v_trip.trip_status
      using errcode = 'P0001';
  end if;

  if v_trip.driver_id is not distinct from p_passenger_id then
    raise exception 'Drivers cannot book their own trip' using errcode = 'P0001';
  end if;

  if v_status = 'confirmed' and v_trip.available_seats < p_seats_requested then
    raise exception 'Not enough seats available (requested: %, available: %)',
      p_seats_requested, v_trip.available_seats
      using errcode = 'P0001';
  end if;

  -- 5. Fare comes from the trip, never from the caller. Read through to_jsonb so
  --    a differently named column fails closed here instead of silently pricing
  --    the booking at 0.
  v_unit_price := coalesce(
    (to_jsonb(v_trip) ->> 'price_per_seat')::numeric,
    (to_jsonb(v_trip) ->> 'price')::numeric
  );
  if v_unit_price is null or v_unit_price < 0 then
    raise exception 'Trip has no valid seat price configured' using errcode = 'P0001';
  end if;
  v_total := round(v_unit_price * p_seats_requested, 3);

  -- 6. Seat number, atomic under the trip lock
  select coalesce(max(seat_number), 0) + 1 into v_seat_number
  from public.bookings
  where trip_id = p_trip_id
    and booking_status not in ('cancelled', 'rejected');

  -- 7. Insert
  insert into public.bookings (
    trip_id, passenger_id, seat_number,
    booking_status, status, confirmed_by_driver,
    amount, pickup_location, dropoff_location,
    seats_requested, total_price
  ) values (
    p_trip_id, p_passenger_id, v_seat_number,
    v_status::text, v_status::text, (v_status = 'confirmed'),
    v_total, p_pickup, p_dropoff,
    p_seats_requested, v_total
  )
  returning * into v_booking;

  -- 8. Take the seats for confirmed bookings
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

-- Same posture as 20260720062017: the Edge Function (service_role) is the only caller.
revoke all on function public.app_create_ride_booking(uuid, uuid, integer, text, text, text, numeric)
  from public, anon, authenticated;
grant execute on function public.app_create_ride_booking(uuid, uuid, integer, text, text, text, numeric)
  to service_role;

notify pgrst, 'reload schema';
