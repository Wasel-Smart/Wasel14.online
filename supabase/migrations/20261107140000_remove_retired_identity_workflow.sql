-- Remove the retired identity submission/review API while preserving existing
-- verification records and legacy columns used by historical migrations.
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.app_complete_sanad_verification(uuid,boolean,uuid,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.app_complete_sanad_verification(uuid, boolean, uuid, text) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
  IF to_regprocedure('public.app_review_sanad_verification(uuid,boolean,uuid,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.app_review_sanad_verification(uuid, boolean, uuid, text) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
  IF to_regprocedure('public.app_submit_sanad_verification(uuid,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.app_submit_sanad_verification(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.app_complete_sanad_verification(uuid, boolean, uuid, text);
DROP FUNCTION IF EXISTS public.app_review_sanad_verification(uuid, boolean, uuid, text);
DROP FUNCTION IF EXISTS public.app_submit_sanad_verification(uuid, text, text);
COMMIT;
