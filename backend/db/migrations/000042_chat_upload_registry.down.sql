DROP INDEX IF EXISTS idx_message_attachment_upload_key;
DROP INDEX IF EXISTS uniq_message_attachment_upload;

ALTER TABLE message_attachment
  DROP COLUMN IF EXISTS upload_key;

DROP INDEX IF EXISTS idx_chat_upload_owner_created;
DROP TABLE IF EXISTS chat_upload;
