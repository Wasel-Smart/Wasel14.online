-- =====================================================
-- Deny client execution of the legacy balance mutators
--
-- Audit finding: 20260720062017_tighten_runtime_privileges_for_production.sql
-- allow-listed `increment_balance`, `decrement_balance` and
-- `increment_pending_balance` to `authenticated` on the assumption that they
-- were internal helpers. No migration in this repository defines them, so on a
-- database built from these migrations the allow-list is already inert
-- (`to_regprocedure` returns NULL and the grant is skipped). On the production
-- database they do exist, were created outside version control, and their
-- definitions were never audited here.
--
-- That combination is the risk: an unknown SECURITY DEFINER function that
-- writes `wallets.balance` directly, reachable by any signed-in user, taking an
-- arbitrary user id as its first argument. RLS cannot help because a definer
-- function runs with the owner's rights, and no in-repo definition exists to
-- prove it performs its own owner check.
--
-- Money must move only through `wallet_post_transaction` via service_role, which
-- is the posture 20261001120000_wallet_rpc_owner_enforcement.sql already applied
-- to the `app_*` RPCs. This migration extends the same revocation to the legacy
-- mutators, and is written to be a no-op where the functions are absent.
-- =====================================================

do $$
declare
  function_signature text;
  legacy_balance_mutators text[] := array[
    'public.increment_balance(uuid,integer)',
    'public.increment_balance(uuid,numeric)',
    'public.decrement_balance(uuid,integer)',
    'public.decrement_balance(uuid,numeric)',
    'public.increment_pending_balance(uuid,integer)',
    'public.increment_pending_balance(uuid,numeric)'
  ];
begin
  foreach function_signature in array legacy_balance_mutators loop
    if to_regprocedure(function_signature) is not null then
      -- Revoke before re-granting: `revoke ... from public` also clears the
      -- implicit PUBLIC execute grant, so PUBLIC can never reach these.
      execute format('revoke execute on function %s from public, anon, authenticated;',
                     to_regprocedure(function_signature));
      execute format('grant execute on function %s to service_role;',
                     to_regprocedure(function_signature));
    end if;
  end loop;
end $$;

-- `wallet_balances` is allow-listed as a read/write table in the same migration
-- but is not defined anywhere in schema history. It is already guarded by a
-- `to_regclass` check, so this is defensive only: if such a table does exist on
-- production it is an unaudited second balance store, and it must not be
-- client-writable. Direct the authoritative balance to remain `wallets`.
do $$
declare
  t text;
  phantom_balance_tables text[] := array['wallet_balances'];
begin
  foreach t in array phantom_balance_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
      execute format('revoke insert, update, delete on table public.%I from anon, authenticated;', t);
    end if;
  end loop;
end $$;

-- Balance mutations are also reachable through PostgREST table writes if any
-- non-service role still holds UPDATE on `wallets`. Strip it here as well so the
-- invariant does not depend on the order in which these migrations were applied.
revoke insert, update, delete on table public.wallets from anon;

-- Edge Function callers use service_role, which bypasses RLS and holds its own
-- grants from 20260720062017, so service_role access is unaffected above.
notify pgrst, 'reload schema';