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
    'app_complete_sanad_verification',
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

-- The client has an authenticated-RPC fallback for identity submission. Keep
-- that path, but bind its caller to the canonical user and serialize concurrent
-- submissions so a client cannot create verification records for other users.
CREATE OR REPLACE FUNCTION public.app_submit_sanad_verification(
  p_user_id uuid,
  p_provider_reference text,
  p_document_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_verification_id uuid;
  v_provider_reference text := nullif(btrim(p_provider_reference), '');
  v_document_reference text := nullif(btrim(p_document_reference), '');
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    AND (
      auth.uid() IS NULL
      OR p_user_id IS DISTINCT FROM public.current_user_id()
    )
  THEN
    RAISE EXCEPTION 'Cannot submit verification for another user'
      USING ERRCODE = '42501';
  END IF;

  IF v_provider_reference IS NULL
    OR length(v_provider_reference) < 6
    OR length(v_provider_reference) > 120
    OR v_provider_reference !~ '^[[:alnum:]_./-]+$'
    OR (
      v_document_reference IS NOT NULL
      AND (
        length(v_document_reference) > 120
        OR v_document_reference ~ '[[:cntrl:]<>]'
      )
    )
  THEN
    RAISE EXCEPTION 'Invalid verification reference' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  IF EXISTS (
    SELECT 1
    FROM public.verification_records vr
    WHERE vr.user_id = p_user_id
      AND vr.sanad_status = 'pending'
      AND coalesce(vr.provider_reference, '') <> 'driver_documents'
  ) THEN
    RAISE EXCEPTION 'Identity verification is already awaiting review'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.verification_records (
    user_id,
    sanad_status,
    document_status,
    verification_level,
    provider_reference,
    document_reference
  ) VALUES (
    p_user_id,
    'pending',
    CASE WHEN v_document_reference IS NULL THEN 'unverified' ELSE 'pending' END,
    'level_1',
    v_provider_reference,
    v_document_reference
  )
  RETURNING verification_id INTO v_verification_id;

  UPDATE public.users
  SET sanad_verified_status = 'pending'
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_verification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.app_submit_sanad_verification(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_submit_sanad_verification(uuid,text,text)
  TO authenticated, service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.app_submit_sanad_verification(uuid,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.app_submit_sanad_verification(uuid,text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.app_submit_sanad_verification(uuid,text,text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'Identity verification RPC has incorrect execution privileges';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
