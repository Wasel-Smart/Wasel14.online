-- Rollback for 20261018000000_lock_communication_delivery_client_inserts.sql
-- Restores the original (relay-prone) client insert policy. Only use if a client
-- flow genuinely depends on writing deliveries directly.

DO $$
BEGIN
  IF to_regclass('public.communication_deliveries') IS NOT NULL THEN
    GRANT INSERT ON public.communication_deliveries TO authenticated;
    DROP POLICY IF EXISTS communication_deliveries_insert_own ON public.communication_deliveries;
    CREATE POLICY communication_deliveries_insert_own
      ON public.communication_deliveries
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_user_id::text = auth.uid()::text));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
