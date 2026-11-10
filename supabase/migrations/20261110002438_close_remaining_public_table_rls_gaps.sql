-- Production already has RLS enabled on every public base table.
-- This migration records that verified state and fails closed on future drift.
-- Tables with RLS but no client policies remain private; do not add placeholder
-- policies to suppress the Supabase advisor INFO findings.
BEGIN;

DO $$
DECLARE
  unprotected_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ' ORDER BY c.relname)
  INTO unprotected_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relrowsecurity = false;

  IF unprotected_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Public base tables without RLS: %', unprotected_tables;
  END IF;
END;
$$;

COMMIT;
