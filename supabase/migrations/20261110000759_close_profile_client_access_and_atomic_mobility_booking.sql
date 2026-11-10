-- Close direct client access to the legacy profile table where it exists.
-- Production currently uses public.users and has no public.profiles table.
BEGIN;

DO $$
DECLARE
  profile_column record;
  legacy_policy text;
  legacy_policies text[] := ARRAY[
    'Public profiles are viewable by everyone',
    'Anyone can view public profile data',
    'Public can view basic profiles',
    'Users can view their own profile',
    'Users can view own profile',
    'Profiles visible to authenticated users (non-deleted)',
    'Users can update own profile',
    'Users can update their own profile',
    'Users can insert their own profile',
    'Users can view own non-deleted profile'
  ];
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE 'Skipping legacy profiles lockdown: public.profiles does not exist.';
  ELSE
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated';

    -- Remove any column-level grants added independently of table grants.
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

    -- Keep the legacy table closed to clients. The self-read policy is defense
    -- in depth if a later migration intentionally restores a narrow grant.
    FOREACH legacy_policy IN ARRAY legacy_policies LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', legacy_policy);
    END LOOP;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name IN ('id', 'deleted_at')
      GROUP BY table_name
      HAVING count(*) = 2
    ) THEN
      EXECUTE 'CREATE POLICY "Users can view own non-deleted profile" ON public.profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()) AND deleted_at IS NULL)';
    END IF;

    EXECUTE 'GRANT ALL PRIVILEGES ON TABLE public.profiles TO service_role';
  END IF;
END;
$$;

COMMIT;
