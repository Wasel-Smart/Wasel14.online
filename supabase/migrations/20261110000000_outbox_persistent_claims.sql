-- Persist outbox claims across the RPC transaction so concurrent worker
-- invocations cannot dispatch the same event. Expired claims are recoverable.
ALTER TABLE public.event_outbox
  ADD COLUMN IF NOT EXISTS claim_token UUID,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_event_outbox_claim_expiry
  ON public.event_outbox (locked_until)
  WHERE status = 'pending';

-- This helper depends on wall clock time and must not be marked IMMUTABLE.
ALTER FUNCTION public.outbox_next_attempt_at(INTEGER) VOLATILE;

CREATE OR REPLACE FUNCTION public.consume_outbox_batch(
  p_batch_size INTEGER DEFAULT 50
)
RETURNS SETOF public.event_outbox
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH candidates AS (
    SELECT o.id
    FROM public.event_outbox o
    WHERE o.status = 'pending'
      AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= NOW())
      AND (o.locked_until IS NULL OR o.locked_until <= NOW())
    ORDER BY o.created_at ASC
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size, 50), 1), 200)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.event_outbox o
  SET claim_token = gen_random_uuid(),
      locked_until = NOW() + INTERVAL '10 minutes'
  FROM candidates c
  WHERE o.id = c.id
  RETURNING o.*;
$$;

CREATE OR REPLACE FUNCTION public.outbox_record_failure(
  p_id UUID,
  p_max_attempts INTEGER DEFAULT 5,
  p_error TEXT DEFAULT NULL,
  p_claim_token UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.event_outbox
  SET attempts = attempts + 1,
      last_error = p_error,
      next_attempt_at = CASE
        WHEN attempts + 1 >= GREATEST(p_max_attempts, 1) THEN NULL
        ELSE public.outbox_next_attempt_at(attempts + 1)
      END,
      status = CASE
        WHEN attempts + 1 >= GREATEST(p_max_attempts, 1) THEN 'failed'
        ELSE 'pending'
      END,
      claim_token = NULL,
      locked_until = NULL
  WHERE id = p_id
    AND (p_claim_token IS NULL OR claim_token = p_claim_token);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_outbox_batch(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_outbox_batch(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.outbox_record_failure(UUID, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outbox_record_failure(UUID, INTEGER, TEXT, UUID) TO service_role;
