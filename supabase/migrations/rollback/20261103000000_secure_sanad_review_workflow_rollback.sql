-- Keep the hardened submission function in place on rollback: restoring the
-- prior function would re-open cross-user submission through SECURITY DEFINER.
BEGIN;
-- Intentionally retain the RPC replacements: the previous SECURITY DEFINER
-- submission function allowed an authenticated caller to nominate another
-- user's ID, and the previous completion function updated every verification
-- row for the user. Reverting either would restore a security/data integrity
-- bug. This migration adds no objects that can be safely dropped independently
-- while the hardened legacy function delegates to app_review_sanad_verification.
DO $$ BEGIN
  RAISE NOTICE 'Security hardening is retained during rollback; deploy a reviewed replacement before removing these RPCs.';
END $$;
COMMIT;
