-- ============================================================================
-- ROLLBACK: 20261028000000_close_wallet_pin_hash_client_access.sql
-- Restores table-level SELECT on wallets for authenticated (re-exposes pin_hash).
-- WARNING: This re-exposes the pin_hash column to authenticated clients.
-- Only apply if the column-level grant causes a confirmed regression.
-- ============================================================================

BEGIN;

-- Restore table-level SELECT (re-exposes all columns including pin_hash).
GRANT SELECT ON public.wallets TO authenticated;

-- Drop the generated pin_set column added by the forward migration.
-- Only drop if no application code depends on it.
ALTER TABLE public.wallets
  DROP COLUMN IF EXISTS pin_set;

COMMIT;

NOTIFY pgrst, 'reload schema';
