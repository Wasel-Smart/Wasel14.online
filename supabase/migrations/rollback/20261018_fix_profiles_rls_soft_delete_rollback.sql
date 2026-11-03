-- Rollback: 20261018000000_fix_profiles_rls_soft_delete.sql
-- Restores the original (broken) public SELECT policy on profiles.

DROP POLICY IF EXISTS "Profiles visible to authenticated users (non-deleted)" ON public.profiles;

GRANT SELECT ON public.profiles TO anon;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);
