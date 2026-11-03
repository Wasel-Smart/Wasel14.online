-- ============================================================================
-- FIX: wallet_balance double-spend risk — ledger-based balance enforcement
-- Migration: 20261019000002_ledger_wallet_balance.sql
-- Problem: profiles.wallet_balance is a mutable NUMERIC column updated by a
--          trigger after each wallet_transaction INSERT. This is a classic
--          double-spend vector: two concurrent transactions can both read the
--          same balance, both pass the balance >= amount check, and both
--          deduct, leaving the balance negative.
-- Fix:
--   1. Add a CHECK constraint that wallet_balance >= 0 (belt-and-suspenders).
--   2. Replace the naive trigger with one that uses a SELECT ... FOR UPDATE
--      on the profiles row to serialize concurrent balance updates.
--   3. Add a balance_check function that reads the authoritative balance from
--      wallet_transactions (sum of all amounts) for audit/reconciliation.
-- ============================================================================

-- ── 1. Ensure wallet_balance cannot go negative ──────────────────────────────

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_wallet_balance_non_negative;

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_wallet_balance_non_negative
    CHECK (wallet_balance >= 0);

-- ── 2. Serialized wallet balance update trigger ──────────────────────────────
-- Uses SELECT ... FOR UPDATE to lock the profile row before reading and
-- updating the balance, preventing concurrent deductions from racing.

CREATE OR REPLACE FUNCTION public.update_wallet_balance_serialized()
RETURNS TRIGGER AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  -- Lock the profile row for this transaction to serialize concurrent updates.
  SELECT wallet_balance INTO current_balance
  FROM public.profiles
  WHERE id = NEW.user_id
  FOR UPDATE;

  -- Validate the balance_before matches the locked current balance.
  -- This catches any race where two transactions read the same balance.
  IF current_balance IS DISTINCT FROM NEW.balance_before THEN
    RAISE EXCEPTION
      'Wallet balance conflict: expected %, found % for user %',
      NEW.balance_before, current_balance, NEW.user_id
      USING ERRCODE = 'serialization_failure';
  END IF;

  -- Apply the balance update.
  UPDATE public.profiles
  SET
    wallet_balance = NEW.balance_after,
    updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the old naive trigger and replace with the serialized version.
DROP TRIGGER IF EXISTS trigger_update_wallet_balance ON public.wallet_transactions;

CREATE TRIGGER trigger_update_wallet_balance_serialized
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_wallet_balance_serialized();

-- ── 3. Audit reconciliation function ─────────────────────────────────────────
-- Returns the authoritative balance computed from the ledger. Use this to
-- detect and alert on any drift between profiles.wallet_balance and the ledger.

CREATE OR REPLACE FUNCTION public.get_authoritative_wallet_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.wallet_transactions
  WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.get_authoritative_wallet_balance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_authoritative_wallet_balance(UUID) TO service_role;
