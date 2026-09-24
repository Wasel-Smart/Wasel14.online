-- Database hardening for production scoring
-- Focus: integrity rules, default-payment safety, and audit-friendly indexes.

ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS chk_trips_package_slots_bounds;
ALTER TABLE public.trips ADD CONSTRAINT chk_trips_package_slots_bounds
  check (package_slots_remaining >= 0 and package_slots_remaining <= package_capacity);

ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS chk_trips_package_mode_consistency;
ALTER TABLE public.trips ADD CONSTRAINT chk_trips_package_mode_consistency
  check (
    (allow_packages = true and package_capacity >= 0)
    or
    (allow_packages = false and package_capacity = 0 and package_slots_remaining = 0)
  );

ALTER TABLE public.packages DROP CONSTRAINT IF EXISTS chk_packages_delivery_state;
ALTER TABLE public.packages ADD CONSTRAINT chk_packages_delivery_state
  check (
    (package_status = 'delivered' and delivered_at is not null)
    or
    (package_status <> 'delivered' and delivered_at is null)
  );

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS chk_transactions_reference_pair;
ALTER TABLE public.transactions ADD CONSTRAINT chk_transactions_reference_pair
  check (
    (reference_id is null and reference_type is null)
    or
    (reference_id is not null and reference_type is not null)
  );

ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS chk_payment_methods_status;
ALTER TABLE public.payment_methods ADD CONSTRAINT chk_payment_methods_status
  check (status in ('active', 'inactive', 'expired', 'revoked'));

create unique index if not exists uq_users_email_lower
  on public.users ((lower(email)));

create unique index if not exists uq_payment_methods_default_per_user
  on public.payment_methods (user_id)
  where is_default;

create index if not exists idx_bookings_passenger_status_created
  on public.bookings (passenger_id, booking_status, created_at desc);

create index if not exists idx_packages_sender_status_created
  on public.packages (sender_id, package_status, created_at desc);

create index if not exists idx_packages_receiver_status_created
  on public.packages (receiver_id, package_status, created_at desc);

create index if not exists idx_package_events_package_created
  on public.package_events (package_id, created_at desc);

create index if not exists idx_payment_methods_user_default
  on public.payment_methods (user_id, is_default, created_at desc);

create or replace function public.ensure_single_default_payment_method()
returns trigger
language plpgsql
as $$
begin
  if new.is_default then
    update public.payment_methods
    set is_default = false
    where user_id = new.user_id
      and payment_method_id <> coalesce(new.payment_method_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and is_default = true;
  elsif not exists (
    select 1
    from public.payment_methods
    where user_id = new.user_id
      and payment_method_id <> coalesce(new.payment_method_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and is_default = true
  ) then
    new.is_default = true;
  end if;

  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_payment_methods_single_default ON public.payment_methods;
create trigger trg_payment_methods_single_default
before insert or update on public.payment_methods
for each row execute function public.ensure_single_default_payment_method();
