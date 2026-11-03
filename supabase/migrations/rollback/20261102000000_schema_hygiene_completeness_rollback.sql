-- ============================================================================
-- ROLLBACK: 20261102000000_schema_hygiene_completeness.sql
-- ============================================================================

BEGIN;

-- Fix 1 rollback: restore get_authoritative_wallet_balance without search_path pin.
-- (Restores the version from 20261019000002 — less secure but functionally identical.)
CREATE OR REPLACE FUNCTION public.get_authoritative_wallet_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.wallet_transactions
  WHERE user_id = p_user_id;
$$;

REVOKE ALL    ON FUNCTION public.get_authoritative_wallet_balance(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_authoritative_wallet_balance(UUID) TO service_role;

-- Fix 2 rollback: restore views without SECURITY INVOKER (owner-rights mode).
DROP VIEW IF EXISTS public.v_user_bookings;
CREATE VIEW public.v_user_bookings AS
  SELECT b.* FROM public.bookings b WHERE b.passenger_id = auth.uid();

DROP VIEW IF EXISTS public.v_user_stats;
CREATE VIEW public.v_user_stats AS
  SELECT p.* FROM public.profiles p WHERE p.id = auth.uid();

REVOKE ALL ON public.v_user_bookings FROM PUBLIC, anon;
REVOKE ALL ON public.v_user_stats    FROM PUBLIC, anon;
GRANT SELECT ON public.v_user_bookings TO authenticated;
GRANT SELECT ON public.v_user_stats    TO authenticated;

-- Fix 3 rollback: restore the client insert policy on communication_deliveries.
DO $$
BEGIN
  IF to_regclass('public.communication_deliveries') IS NOT NULL THEN
    GRANT INSERT ON public.communication_deliveries TO authenticated;
    DROP POLICY IF EXISTS communication_deliveries_insert_own ON public.communication_deliveries;
    CREATE POLICY communication_deliveries_insert_own
      ON public.communication_deliveries
      FOR INSERT TO authenticated
      WITH CHECK (user_id IN (
        SELECT id FROM public.users WHERE auth_user_id::text = auth.uid()::text
      ));
  END IF;
END $$;

-- Fix 4 rollback: restore update_wallet_balance_serialized without search_path pin.
CREATE OR REPLACE FUNCTION public.update_wallet_balance_serialized()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  SELECT wallet_balance INTO current_balance
  FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;

  IF current_balance IS DISTINCT FROM NEW.balance_before THEN
    RAISE EXCEPTION
      'Wallet balance conflict: expected %, found % for user %',
      NEW.balance_before, current_balance, NEW.user_id
      USING ERRCODE = 'serialization_failure';
  END IF;

  UPDATE public.profiles
  SET wallet_balance = NEW.balance_after, updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
