-- ============================================================================
-- Lock client-side inserts into communication_deliveries
-- Date: 2026-10-18
--
-- Why: communications_runtime_contract (20260401223000) created the policy
-- communication_deliveries_insert_own, which lets any signed-in user INSERT a
-- row whose user_id is their own, with ANY destination / channel / body, straight
-- through PostgREST. A worker later sends every 'queued' row from the platform's
-- Twilio / Resend / SendGrid accounts, so that policy is an SMS / email relay that
-- bypasses the destination restrictions enforced in the edge function
-- (handleQueueCommunicationDeliveries). Deliveries are written by the edge
-- function with service_role, which ignores RLS, so clients need no insert path.
--
-- Effect on the web client: queueDirectCommunicationDeliveries (the
-- "writes-if-enabled" fallback in src/services/communicationPreferences.ts) will
-- now be rejected and fall back to the local outbox, which is already handled.
--
-- Guarded and idempotent: a no-op where the table or policy does not exist.
-- Review on staging first; production schema differs from the local migration
-- history (see header of 20261017000000_rls_price_and_view_hardening.sql).
-- Rollback: supabase/migrations/rollback/20261018_lock_communication_delivery_client_inserts_rollback.sql
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.communication_deliveries') IS NOT NULL THEN
    DROP POLICY IF EXISTS communication_deliveries_insert_own ON public.communication_deliveries;
    REVOKE INSERT, UPDATE, DELETE ON public.communication_deliveries FROM anon, authenticated;
  ELSE
    RAISE NOTICE 'public.communication_deliveries not found; nothing to lock';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
