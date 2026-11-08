BEGIN;

CREATE TEMP TABLE _saved_driver_view_acl ON COMMIT DROP AS
SELECT
  CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END AS grantee,
  acl.privilege_type,
  acl.is_grantable
FROM pg_class relation
JOIN pg_namespace schema ON schema.oid = relation.relnamespace
CROSS JOIN LATERAL aclexplode(COALESCE(relation.relacl, acldefault('r', relation.relowner))) acl
WHERE schema.nspname = 'public' AND relation.relname = 'v_drivers_public';

DROP VIEW IF EXISTS public.v_drivers_public;

CREATE OR REPLACE FUNCTION public.app_approve_driver(p_driver_id uuid, p_admin_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_log_id uuid;
BEGIN
  UPDATE public.drivers
  SET driver_status = 'approved', verification_level = 'level_3'
  WHERE driver_id = p_driver_id
  RETURNING user_id INTO v_user_id;

  UPDATE public.users
  SET role = 'driver', verification_level = 'level_3', profile_status = 'active'
  WHERE id = v_user_id;

  INSERT INTO public.admin_logs (admin_id, action, entity_type, entity_id, metadata)
  VALUES (p_admin_id, 'approve_driver', 'driver', p_driver_id,
          jsonb_build_object('user_id', v_user_id))
  RETURNING log_id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

DROP POLICY IF EXISTS drivers_insert_pending_self ON public.drivers;
CREATE POLICY drivers_insert_pending_self ON public.drivers
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT private.current_profile_id())
  AND vehicle_id IS NULL
  AND driver_status = 'pending_approval'::driver_status_v2
  AND background_check_status = 'pending'::verification_status_v2
  AND verification_level = (
    SELECT u.verification_level FROM public.users u WHERE u.id = drivers.user_id
  )
);

DROP POLICY IF EXISTS verification_records_insert_pending_self ON public.verification_records;
CREATE POLICY verification_records_insert_pending_self ON public.verification_records
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT private.current_profile_id())
  AND document_status = 'pending'::verification_status_v2
  AND reviewer_admin_id IS NULL
  AND failure_reason IS NULL
  AND verification_level = (
    SELECT u.verification_level FROM public.users u
    WHERE u.id = verification_records.user_id
  )
);

ALTER TABLE public.drivers DROP COLUMN IF EXISTS sanad_identity_linked;
ALTER TABLE public.users DROP COLUMN IF EXISTS sanad_verified_status;
ALTER TABLE public.verification_records DROP COLUMN IF EXISTS sanad_status;

CREATE VIEW public.v_drivers_public WITH (security_invoker = true) AS
SELECT driver_id, user_id, driver_status, verification_level,
       background_check_status, created_at
FROM public.drivers;
ALTER VIEW public.v_drivers_public OWNER TO postgres;

DO $$
DECLARE saved_acl record;
BEGIN
  FOR saved_acl IN SELECT * FROM _saved_driver_view_acl LOOP
    IF saved_acl.grantee = 'postgres' THEN CONTINUE; END IF;
    EXECUTE format('GRANT %s ON public.v_drivers_public TO %s%s',
      saved_acl.privilege_type,
      CASE WHEN saved_acl.grantee = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(saved_acl.grantee) END,
      CASE WHEN saved_acl.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
END $$;

COMMIT;
