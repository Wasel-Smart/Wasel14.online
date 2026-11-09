-- Rollback persistent outbox claims. This restores the pre-claim RPC behavior.
DROP FUNCTION IF EXISTS public.outbox_record_failure(UUID, INTEGER, TEXT, UUID);

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

CREATE OR REPLACE FUNCTION public.outbox_record_failure(
  p_id UUID,
  p_max_attempts INTEGER DEFAULT 5,
  p_error TEXT DEFAULT NULL
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
        WHEN attempts + 1 >= p_max_attempts THEN NULL
        ELSE public.outbox_next_attempt_at(attempts + 1)
      END,
      status = CASE
        WHEN attempts + 1 >= p_max_attempts THEN 'failed'
        ELSE 'pending'
      END
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_outbox_batch(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_outbox_batch(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.outbox_record_failure(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outbox_record_failure(UUID, INTEGER, TEXT) TO service_role;

DROP INDEX IF EXISTS public.idx_event_outbox_claim_expiry;
ALTER TABLE public.event_outbox
  DROP COLUMN IF EXISTS claim_token,
  DROP COLUMN IF EXISTS locked_until;

ALTER FUNCTION public.outbox_next_attempt_at(INTEGER) IMMUTABLE;
