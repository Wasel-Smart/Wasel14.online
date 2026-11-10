-- Close direct client access to legacy profiles.
-- The canonical user/profile and wallet APIs now use public.users and
-- public.wallets. public.profiles contains redundant PII and privileged fields,
-- so browser/mobile clients must not read or write it directly.
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

-- Remove any column-level grants that might have been added independently of
-- the table-level grants above. New profile fields remain private by default.
DO $$
DECLARE
  profile_column record;
BEGIN
  FOR profile_column IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
  LOOP
    EXECUTE format(
      'REVOKE SELECT (%1$I), INSERT (%1$I), UPDATE (%1$I), REFERENCES (%1$I) ON TABLE public.profiles FROM PUBLIC, anon, authenticated',
      profile_column.column_name
    );
  END LOOP;
END;
$$;

-- Remove the historical broad profile policies. Keep a restrictive self-read
-- policy as defense in depth if a later migration intentionally restores a
-- narrowly scoped grant. There is deliberately no client write policy.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view public profile data" ON public.profiles;
DROP POLICY IF EXISTS "Public can view basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles visible to authenticated users (non-deleted)" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view own non-deleted profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()) AND deleted_at IS NULL);

GRANT ALL PRIVILEGES ON TABLE public.profiles TO service_role;

COMMIT;
