-- 1. Index for optimizing listing of conversations (eliminate seq scan)
CREATE INDEX IF NOT EXISTS idx_conversation_participant_user_id ON conversation_participant(user_id);

-- 2. New message_attachment table for multiple attachments support
CREATE TABLE IF NOT EXISTS message_attachment (
  id            BIGSERIAL PRIMARY KEY,
  message_id    bigint NOT NULL REFERENCES message(id) ON DELETE CASCADE,
  url           text NOT NULL,
  file_name     varchar(500),
  mime_type     varchar(100),
  size_bytes    bigint,
  width         int,
  height        int,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_attachment_message ON message_attachment(message_id);

-- 3. Modify message table to make body nullable
ALTER TABLE message ALTER COLUMN body DROP NOT NULL;

-- 4. Tracking last read message in conversation
ALTER TABLE conversation_participant ADD COLUMN IF NOT EXISTS last_read_message_id bigint;

-- 5. Convert relevant timestamp columns to timestamptz for timezone safety
ALTER TABLE conversation ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE conversation ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE conversation_participant ALTER COLUMN last_read_at TYPE timestamptz USING last_read_at AT TIME ZONE 'UTC';
ALTER TABLE message ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
