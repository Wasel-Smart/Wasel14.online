-- Stop future public API objects created by supabase_admin from receiving
-- broad client privileges implicitly. Existing object grants are unchanged;
-- migrations must explicitly grant only the required access.
BEGIN;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Function EXECUTE is granted to PUBLIC by PostgreSQL's global default.
-- Revoke it globally because a schema-scoped REVOKE cannot cancel that grant.
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;