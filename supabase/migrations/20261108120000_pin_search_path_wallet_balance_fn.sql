-- ============================================================================
-- Harden get_authoritative_wallet_balance
-- ----------------------------------------------------------------------------
-- The function is SECURITY DEFINER but had no fixed search_path, so a caller who
-- can create objects in a schema earlier on their own search_path could shadow
-- `wallet_transactions` or SUM and run code with the owner's privileges.
-- Pin the path and keep EXECUTE limited to service_role.
--
-- Guarded with a catalog lookup so the migration is a no-op on databases where
-- the function was retired by an earlier cutover.
-- ============================================================================

DO $$
BEGIN
  IF to_regprocedure('public.get_authoritative_wallet_balance(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.get_authoritative_wallet_balance(uuid)
      SET search_path = public, pg_temp;

    REVOKE ALL ON FUNCTION public.get_authoritative_wallet_balance(uuid) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_authoritative_wallet_balance(uuid) TO service_role;
  END IF;
END
$$;
