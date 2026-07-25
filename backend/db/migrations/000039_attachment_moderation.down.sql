DROP TABLE IF EXISTS attachment_moderation_job;

DROP INDEX IF EXISTS idx_message_attachment_pending;

ALTER TABLE message_attachment
  DROP COLUMN IF EXISTS moderation_status,
  DROP COLUMN IF EXISTS duration_seconds,
  DROP COLUMN IF EXISTS thumbnail_url;
