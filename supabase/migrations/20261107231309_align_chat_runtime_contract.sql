-- Extend the deployed conversation schema for the canonical Edge chat API.
-- The migration is additive and leaves existing messages and memberships intact.
BEGIN;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND conname = 'messages_type_valid'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_type_valid
      CHECK (type IN ('text', 'location', 'system'));
  END IF;
END;
$$;

-- Trip conversations use a stable title. A partial unique index prevents two
-- concurrent first messages from creating separate conversations for one trip.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_trip_title_unique
  ON public.conversations (title)
  WHERE title LIKE 'trip:%';

COMMIT;
