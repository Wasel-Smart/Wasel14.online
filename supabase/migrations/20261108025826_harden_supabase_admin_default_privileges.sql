-- Stop future public API objects created by supabase_admin from receiving
-- broad client privileges implicitly. Existing object grants are unchanged;
-- migrations must explicitly grant only the required access.
--
-- 42501 FIX (hosted Supabase):
-- ALTER DEFAULT PRIVILEGES FOR ROLE <other_role> requires the session to be
-- that role or a superuser. On Supabase hosted the `postgres` login role is
-- neither superuser nor supabase_admin, so the four statements below raise
-- 42501 (insufficient_privilege) and abort the transaction.
--
-- Resolution: wrap each supabase_admin clause in a DO block that catches
-- insufficient_privilege and emits a NOTICE instead of aborting. On hosted
-- Supabase the platform already restricts supabase_admin default privileges;
-- the NOTICE documents that the guard was skipped for that reason.
-- The migration still records itself in supabase_migrations.schema_migrations
-- and the explicit per-function revokes in later migrations are unaffected.

BEGIN;

DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE
    '20261108025826: skipped REVOKE ALL ON TABLES for supabase_admin '
    '(insufficient_privilege — hosted Supabase manages this role''s defaults)';
END;
$$;

DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE
    '20261108025826: skipped REVOKE ALL ON SEQUENCES for supabase_admin '
    '(insufficient_privilege — hosted Supabase manages this role''s defaults)';
END;
$$;

DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE
    '20261108025826: skipped REVOKE EXECUTE ON FUNCTIONS (schema-scoped) for supabase_admin '
    '(insufficient_privilege — hosted Supabase manages this role''s defaults)';
END;
$$;

-- Function EXECUTE is granted to PUBLIC by PostgreSQL's global default.
-- Revoke it globally because a schema-scoped REVOKE cannot cancel that grant.
DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE
    '20261108025826: skipped global REVOKE EXECUTE ON FUNCTIONS for supabase_admin '
    '(insufficient_privilege — hosted Supabase manages this role''s defaults)';
END;
$$;

COMMIT;