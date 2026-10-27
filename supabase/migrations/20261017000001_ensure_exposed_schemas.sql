-- ============================================================================
-- Ensure every schema listed in supabase/config.toml [api].schemas exists
-- Date: 2026-10-17
--
-- Problem: `supabase start` fails on a fresh local database because PostgREST is
-- told to expose `api`, `stripe` and `pgmq_public`, but no migration creates them
-- (they only exist on the hosted project). PostgREST then loops forever with
--   {"code":"3F000","message":"schema \"api\" does not exist"}
-- and the CLI aborts with "supabase_rest_wasel unexpected status 503".
--
-- Fix: create the missing schemas as empty containers. Safe to re-run, and a no-op
-- on the hosted project where they already exist. Nothing is granted to anon or
-- authenticated here, so exposing an empty schema adds no attack surface.
--
-- Rollback: intentionally none. Do NOT `DROP SCHEMA stripe` / `pgmq_public` on a
-- project that uses the Stripe wrapper or Supabase Queues.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS api;
CREATE SCHEMA IF NOT EXISTS stripe;
CREATE SCHEMA IF NOT EXISTS pgmq_public;

COMMENT ON SCHEMA api IS 'Reserved for versioned API views/RPCs; exposed via PostgREST.';

-- Make PostgREST pick the schemas up if it is already running.
NOTIFY pgrst, 'reload schema';
