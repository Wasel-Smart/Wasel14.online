-- Keep rider-to-driver activation available when the Edge API is degraded
-- without enabling general client-side writes to the users table.
BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE OR REPLACE FUNCTION app_private.enable_driver_mode()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT u.id, u.role::text
  INTO v_user_id, v_role
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
     OR (u.auth_user_id IS NULL AND u.id = auth.uid())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complete your account profile before enabling Driver mode'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_role IN ('admin', 'operator') THEN
    RAISE EXCEPTION 'Staff accounts cannot switch to Driver mode'
      USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'driver' THEN
    UPDATE public.users
    SET role = 'driver',
        updated_at = timezone('utc', now())
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('enabled', true, 'role', 'driver');
END;
$$;

REVOKE ALL ON FUNCTION app_private.enable_driver_mode() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.enable_driver_mode() TO authenticated;

CREATE OR REPLACE FUNCTION public.app_enable_driver_mode()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT app_private.enable_driver_mode();
$$;

REVOKE ALL ON FUNCTION public.app_enable_driver_mode() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_enable_driver_mode() TO authenticated;

COMMIT;
