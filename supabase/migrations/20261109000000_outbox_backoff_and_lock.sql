-- ============================================================================
-- OUTBOX WORKER: EXPONENTIAL BACKOFF + DISTRIBUTED LOCK
-- Migration: 20261109000000_outbox_backoff_and_lock.sql
--
-- Problems addressed:
--   1. event_outbox has no next_attempt_at column, so failed events are retried
--      on every drain cycle at the same rate regardless of failure type.
--      This migration adds next_attempt_at and a DB function that computes
--      exponential backoff (base 2s, capped at 5 minutes).
--
--   2. Two concurrent outbox-worker invocations (cron overlap or manual trigger)
--      both SELECT the same pending batch and dispatch the same events, causing
--      duplicate notifications, double-matched rides, etc.
--      This migration adds consume_outbox_batch() which atomically claims a
--      batch with SELECT ... FOR UPDATE SKIP LOCKED so only one worker processes
--      each row.
--
-- Rollback: supabase/migrations/rollback/20261109000000_outbox_backoff_and_lock_rollback.sql
-- ============================================================================

-- ── 1. Add backoff columns to event_outbox ────────────────────────────────────

ALTER TABLE public.event_outbox
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error       TEXT;

-- Backfill: existing pending rows are immediately eligible.
UPDATE public.event_outbox
SET next_attempt_at = NOW()
WHERE next_attempt_at IS NULL
  AND status = 'pending';

-- Index so the worker query hits only due rows.
CREATE INDEX IF NOT EXISTS idx_event_outbox_next_attempt
  ON public.event_outbox (next_attempt_at ASC)
  WHERE status = 'pending';

-- ── 2. Backoff helper ─────────────────────────────────────────────────────────
-- Returns the timestamp at which attempt number p_attempts should be retried.
-- Schedule: 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 300s (cap).

CREATE OR REPLACE FUNCTION public.outbox_next_attempt_at(p_attempts INTEGER)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT NOW() + LEAST(
    POWER(2, GREATEST(p_attempts, 0)) * INTERVAL '1 second',
    INTERVAL '5 minutes'
  );
$$;

REVOKE ALL ON FUNCTION public.outbox_next_attempt_at(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.outbox_next_attempt_at(INTEGER) TO service_role;

-- ── 3. Atomic batch claim ─────────────────────────────────────────────────────
-- Selects up to p_batch_size pending rows that are due for processing and locks
-- them with SKIP LOCKED so concurrent workers never claim the same row.
-- Returns the locked rows so the caller can dispatch them without a second query.

CREATE OR REPLACE FUNCTION public.consume_outbox_batch(
  p_batch_size INTEGER DEFAULT 50
)
RETURNS SETOF public.event_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
    SELECT o.*
    FROM public.event_outbox o
    WHERE o.status = 'pending'
      AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= NOW())
    ORDER BY o.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_outbox_batch(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_outbox_batch(INTEGER) TO service_role;

-- ── 4. Mark-failed helper ─────────────────────────────────────────────────────
-- Updates a single outbox row after a failed dispatch attempt:
--   - increments attempts
--   - sets next_attempt_at via exponential backoff
--   - transitions to 'failed' once max_attempts is reached
--   - records the last error message

CREATE OR REPLACE FUNCTION public.outbox_record_failure(
  p_id           UUID,
  p_max_attempts INTEGER DEFAULT 5,
  p_error        TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next_attempts INTEGER;
BEGIN
  UPDATE public.event_outbox
  SET
    attempts        = attempts + 1,
    last_error      = p_error,
    next_attempt_at = CASE
                        WHEN attempts + 1 >= p_max_attempts THEN NULL
                        ELSE public.outbox_next_attempt_at(attempts + 1)
                      END,
    status          = CASE
                        WHEN attempts + 1 >= p_max_attempts THEN 'failed'
                        ELSE 'pending'
                      END
  WHERE id = p_id
  RETURNING attempts INTO v_next_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.outbox_record_failure(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.outbox_record_failure(UUID, INTEGER, TEXT) TO service_role;

DO $$
BEGIN
  RAISE NOTICE '✅ 20261109000000: outbox backoff and distributed lock complete';
  RAISE NOTICE '   - next_attempt_at + last_error columns on event_outbox';
  RAISE NOTICE '   - outbox_next_attempt_at() exponential backoff helper';
  RAISE NOTICE '   - consume_outbox_batch() atomic SKIP LOCKED claim';
  RAISE NOTICE '   - outbox_record_failure() backoff + DLQ transition helper';
END $$;
