-- ============================================================================
-- FIX: Conflicting profiles RLS policies leaking soft-deleted users
-- Migration: 20261018000000_fix_profiles_rls_soft_delete.sql
-- Problem: Multiple SELECT policies existed on profiles — one with USING (true)
--          and one with USING (deleted_at IS NULL). PostgreSQL ORs all permissive
--          policies, so the USING (true) policy overrode the soft-delete filter,
--          exposing deleted user rows to any authenticated query.
-- Fix: Drop all conflicting public SELECT policies and replace with a single
--      canonical policy that enforces deleted_at IS NULL.
-- ============================================================================

-- Drop every known variant of the unrestricted public SELECT policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone"    ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view public profile data"         ON public.profiles;
DROP POLICY IF EXISTS "Public can view basic profiles"              ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile"            ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"                  ON public.profiles;

-- Single canonical public SELECT policy: never expose soft-deleted rows
CREATE POLICY "Profiles visible to authenticated users (non-deleted)"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Service role bypasses RLS entirely — no policy needed for it.
-- Anon users have no legitimate reason to read profiles directly.
REVOKE SELECT ON public.profiles FROM anon;
