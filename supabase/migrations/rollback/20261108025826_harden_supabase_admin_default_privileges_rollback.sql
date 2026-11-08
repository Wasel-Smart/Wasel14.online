-- Restore the pre-hardening defaults for objects created by supabase_admin.
-- Mirrors the 42501 guard in the forward migration: each clause is wrapped in
-- a DO block so the rollback completes on hosted Supabase even when the session
-- lacks ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin privilege.
BEGIN;

DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
    GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
    ON TABLES TO anon, authenticated;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '20261108025826 rollback: skipped TABLE grant for supabase_admin (insufficient_privilege)';
END;
$$;

DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
    GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO anon, authenticated;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '20261108025826 rollback: skipped SEQUENCE grant for supabase_admin (insufficient_privilege)';
END;
$$;

DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '20261108025826 rollback: skipped FUNCTION grant (schema-scoped) for supabase_admin (insufficient_privilege)';
END;
$$;

DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
    GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE '20261108025826 rollback: skipped global FUNCTION grant for supabase_admin (insufficient_privilege)';
END;
$$;

COMMIT;
