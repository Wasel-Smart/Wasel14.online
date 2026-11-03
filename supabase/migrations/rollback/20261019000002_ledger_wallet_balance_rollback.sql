-- ============================================================================
-- ROLLBACK: 20261019000002_ledger_wallet_balance.sql
-- Removes the serialized wallet trigger, the non-negative CHECK constraint,
-- and the audit reconciliation function added by the forward migration.
-- WARNING: Removing the serialized trigger re-opens the double-spend race.
-- Only apply after draining all in-flight wallet transactions.
-- ============================================================================

BEGIN;

-- Drop the serialized trigger and its function.
DROP TRIGGER  IF EXISTS trigger_update_wallet_balance_serialized ON public.wallet_transactions;
DROP FUNCTION IF EXISTS public.update_wallet_balance_serialized();

-- Drop the audit reconciliation function.
DROP FUNCTION IF EXISTS public.get_authoritative_wallet_balance(UUID);

-- Remove the non-negative balance constraint.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_wallet_balance_non_negative;

COMMIT;
