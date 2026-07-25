DROP INDEX IF EXISTS idx_message_reply_to;

ALTER TABLE message
  DROP COLUMN IF EXISTS reply_to_message_id,
  DROP COLUMN IF EXISTS edited_at,
  DROP COLUMN IF EXISTS deleted_at;
