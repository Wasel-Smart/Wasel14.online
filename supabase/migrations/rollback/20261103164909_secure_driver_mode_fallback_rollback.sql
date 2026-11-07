-- Remove only the driver-mode fallback RPCs; retain the shared private schema.
BEGIN;

REVOKE ALL ON FUNCTION public.app_enable_driver_mode() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.app_enable_driver_mode();

REVOKE ALL ON FUNCTION app_private.enable_driver_mode() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS app_private.enable_driver_mode();

COMMIT;
