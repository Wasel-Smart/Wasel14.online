-- Roll back the chat contract's uniqueness guard while keeping additive message
-- metadata and read timestamps so rollback does not discard values written by a
-- newer runtime. The extra columns are harmless to the prior runtime.
BEGIN;
DROP INDEX IF EXISTS public.conversations_trip_title_unique;
COMMIT;
