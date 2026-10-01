-- Migration: shared, database-backed rate limiter for edge functions.
--
-- The main edge function had no rate limiting at all (the shared limiter under
-- backend/ was a stub that always allowed). Edge isolates are stateless, so the
-- counter has to live in Postgres. One atomic upsert per call keeps it correct
-- across concurrent isolates.

create table if not exists public.api_rate_limits (
  bucket_key   text        primary key,
  window_start timestamptz not null default now(),
  hit_count    integer     not null default 0
);

comment on table public.api_rate_limits is
  'Fixed-window counters used by edge functions (consume_rate_limit). Service role only.';

alter table public.api_rate_limits enable row level security;
-- Intentionally no policies: anon/authenticated can never read or write buckets.
revoke all on table public.api_rate_limits from anon, authenticated;

create index if not exists idx_api_rate_limits_window_start
  on public.api_rate_limits (window_start);

-- Atomically records one hit and reports whether it is within the limit.
create or replace function public.consume_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now     timestamptz := now();
  v_window  interval    := make_interval(secs => greatest(p_window_seconds, 1));
  v_hits    integer;
  v_start   timestamptz;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200 then
    raise exception 'invalid rate limit key';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'invalid rate limit';
  end if;

  insert into public.api_rate_limits as r (bucket_key, window_start, hit_count)
  values (p_key, v_now, 1)
  on conflict (bucket_key) do update
    set window_start = case
          when r.window_start + v_window <= v_now then v_now
          else r.window_start
        end,
        hit_count = case
          when r.window_start + v_window <= v_now then 1
          else r.hit_count + 1
        end
  returning r.hit_count, r.window_start into v_hits, v_start;

  allowed := v_hits <= p_limit;
  remaining := greatest(p_limit - v_hits, 0);
  retry_after_seconds := greatest(
    ceil(extract(epoch from (v_start + v_window - v_now)))::integer,
    0
  );
  return next;
end;
$$;

-- Clears a bucket, e.g. after a successful PIN verification.
create or replace function public.reset_rate_limit(p_key text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.api_rate_limits where bucket_key = p_key;
$$;

-- Housekeeping: drop buckets whose window ended more than a day ago.
create or replace function public.cleanup_api_rate_limits()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count bigint;
begin
  with deleted as (
    delete from public.api_rate_limits
    where window_start < now() - interval '1 day'
    returning 1
  )
  select count(*) into v_count from deleted;
  return v_count;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.reset_rate_limit(text) from public, anon, authenticated;
revoke all on function public.cleanup_api_rate_limits() from public, anon, authenticated;

grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.reset_rate_limit(text) to service_role;
grant execute on function public.cleanup_api_rate_limits() to service_role;
