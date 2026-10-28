-- ============================================================================
-- Close client access to wallets.pin_hash
-- Date: 2026-10-28
--
-- Why: `authenticated` held table-level SELECT on public.wallets, so any signed-in
-- user could read their own wallet row INCLUDING pin_hash (a hash of a 4-6 digit
-- PIN is brute-forceable offline in milliseconds). The browser fallback
-- (src/services/wallet/walletDirect.ts) actually did `select('*')` and shipped the
-- hash to the client just to compute `pinSet`.
--
-- Fix: switch to a column allow-list. PIN verification already happens only in the
-- edge function with the service role (make-server wallet handler), which is not
-- affected. The UI keeps working through the new non-secret `pin_set` boolean.
--
-- NOTE: because this is an allow-list, columns added to wallets later are NOT
-- client-readable until explicitly granted. That is intentional (fail closed).
-- Rollback: supabase/migrations/rollback/20261028_close_wallet_pin_hash_client_access_rollback.sql
-- ============================================================================

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS pin_set boolean GENERATED ALWAYS AS (pin_hash IS NOT NULL) STORED;

REVOKE SELECT ON TABLE public.wallets FROM anon, authenticated;

GRANT SELECT (
  wallet_id,
  user_id,
  balance,
  pending_balance,
  wallet_status,
  currency_code,
  created_at,
  updated_at,
  auto_top_up_enabled,
  auto_top_up_amount,
  auto_top_up_threshold,
  pin_set
) ON public.wallets TO authenticated;

NOTIFY pgrst, 'reload schema';
