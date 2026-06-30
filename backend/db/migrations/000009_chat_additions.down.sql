ALTER TABLE message ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE 'UTC';
ALTER TABLE conversation_participant ALTER COLUMN last_read_at TYPE timestamp USING last_read_at AT TIME ZONE 'UTC';
ALTER TABLE conversation ALTER COLUMN updated_at TYPE timestamp USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE conversation ALTER COLUMN created_at TYPE timestamp USING created_at AT TIME ZONE 'UTC';

ALTER TABLE conversation_participant DROP COLUMN IF EXISTS last_read_message_id;

ALTER TABLE message ALTER COLUMN body SET NOT NULL;

DROP TABLE IF EXISTS message_attachment;

DROP INDEX IF EXISTS idx_conversation_participant_user_id;
