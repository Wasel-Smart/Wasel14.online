-- Rollback: 20261109000000_outbox_backoff_and_lock_rollback.sql

DROP FUNCTION IF EXISTS public.outbox_record_failure(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.consume_outbox_batch(INTEGER);
DROP FUNCTION IF EXISTS public.outbox_next_attempt_at(INTEGER);

DROP INDEX IF EXISTS public.idx_event_outbox_next_attempt;

ALTER TABLE public.event_outbox
  DROP COLUMN IF EXISTS next_attempt_at,
  DROP COLUMN IF EXISTS last_error;
