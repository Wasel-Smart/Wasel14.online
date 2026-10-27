-- ============================================================================
-- Wasel: read-only client-privilege probe
-- Run against PRODUCTION (SQL editor). Every statement is a SELECT; nothing is changed.
-- Purpose: local migrations do not match production, so reading the repo cannot
-- prove what a signed-in user can actually do. These queries can.
-- Expected result for every query: ZERO rows (except where noted).
-- ============================================================================

-- 1. SECURITY DEFINER functions in public that anon/authenticated can execute.
--    Each one runs with the owner's rights and bypasses RLS, so each must either be
--    intentionally public or perform its own auth.uid()/current_user_id() check.
--    Expected: only functions you consciously exposed (e.g. read-only helpers).
select p.oid::regprocedure as function,
       has_function_privilege('anon', p.oid, 'execute')          as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'))
order by 1;

-- 2. Money-moving functions specifically. Expected: zero rows.
select p.oid::regprocedure as function
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'wallet\_%' escape '\'
       or p.proname like 'app\_%' escape '\'
       or p.proname in ('increment_balance','decrement_balance','increment_pending_balance'))
  and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'));

-- 3. Tables a client role can write directly (bypassing the edge function).
--    Expected: only tables you intend clients to write; NEVER wallets, transactions,
--    communication_deliveries, payment_methods' provider columns, drivers, verification_records.
select grantee, table_name, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
group by grantee, table_name
order by grantee, table_name;

-- 4. Tables in public with row level security DISABLED. Expected: zero rows.
select c.relname as table_without_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;

-- 5. Policies that apply to PUBLIC/anon (no TO clause) on writable commands. Expected: zero rows.
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and (roles @> '{public}' or roles @> '{anon}')
order by tablename, policyname;

-- 6. Views that run with the owner's rights (bypass RLS). Expected: none that expose user data.
select c.relname as view_name,
       coalesce(c.reloptions::text, '(security_invoker not set: owner rights)') as options
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
  and not coalesce(c.reloptions::text, '') like '%security_invoker=true%'
order by 1;

-- 7. Wallet integrity: any wallet whose balance does not equal the sum of its posted ledger.
--    Expected: zero rows. A non-empty result means money moved outside the ledger or
--    a pending/failed row was credited.
select w.wallet_id, w.balance,
       coalesce(sum(case when t.direction = 'credit' then t.amount else -t.amount end), 0) as ledger_balance
from public.wallets w
left join public.transactions t
       on t.wallet_id = w.wallet_id and t.transaction_status = 'posted'
group by w.wallet_id, w.balance
having abs(w.balance - coalesce(sum(case when t.direction = 'credit' then t.amount else -t.amount end), 0)) > 0.0005
order by abs(w.balance - coalesce(sum(case when t.direction = 'credit' then t.amount else -t.amount end), 0)) desc
limit 50;

-- 8. Top-ups stuck in 'pending' for over 48h (abandoned checkouts that were never expired). Informational.
select count(*) as stale_pending_topups
from public.transactions
where transaction_type = 'add_funds' and transaction_status = 'pending'
  and created_at < now() - interval '48 hours';

-- 9. Top-ups the new amount check refused to credit (needs manual reconciliation).
select transaction_id, wallet_id, amount, metadata -> 'amount_mismatch' as mismatch, created_at
from public.transactions
where metadata ? 'amount_mismatch'
order by created_at desc;

-- 10. Deliveries stuck in 'processing' (crashed worker). Informational.
select count(*) as stuck_processing
from public.communication_deliveries
where delivery_status = 'processing' and locked_at < now() - interval '10 minutes';
