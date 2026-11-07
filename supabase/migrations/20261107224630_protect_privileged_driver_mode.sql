-- Restrict the authenticated fallback to ordinary passenger accounts.
-- Driver-mode activation is a one-way role transition for passenger accounts;
-- unexpected and staff roles fail closed rather than being overwritten.
BEGIN;

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

  IF v_role IS DISTINCT FROM 'passenger' THEN
    RAISE EXCEPTION 'Only passenger accounts can switch to Driver mode'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.users
  SET role = 'driver',
      updated_at = timezone('utc', now())
  WHERE id = v_user_id;

  RETURN jsonb_build_object('enabled', true, 'role', 'driver');
END;
$$;

COMMIT;
