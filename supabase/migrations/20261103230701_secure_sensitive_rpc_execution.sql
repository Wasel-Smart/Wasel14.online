-- Keep privileged, SECURITY DEFINER operations behind the authenticated edge
-- API.  These routines accept user/driver IDs as parameters and the historical
-- grant list exposed them directly to every authenticated Data API caller.
-- The edge functions use the service-role client after validating the caller.

BEGIN;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

DO $$
DECLARE
  target_function regprocedure;
  service_only_function_names text[] := ARRAY[
    'wallet_post_transaction',
    'app_add_wallet_funds',
    'app_transfer_wallet_funds',
    'app_create_trip',
    'app_book_trip',
    'app_assign_package_to_trip',
    'app_withdraw_wallet_funds',
    'app_pay_with_wallet',
    'app_credit_driver_earnings',
    'app_confirm_package_delivery',
    'app_approve_driver',
    'increment_balance',
    'decrement_balance',
    'increment_pending_balance',
    'app_create_ride_booking',
    'app_cancel_trip_booking',
    'app_get_driver_rating'
  ];
BEGIN
  FOR target_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(service_only_function_names)
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      target_function
    );
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', target_function);

    IF has_function_privilege('anon', target_function, 'EXECUTE')
      OR has_function_privilege('authenticated', target_function, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'Sensitive RPC % remains callable by an untrusted API role', target_function;
    END IF;
    IF NOT has_function_privilege('service_role', target_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'Service role cannot execute required RPC %', target_function;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
