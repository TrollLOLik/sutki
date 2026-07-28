ALTER TABLE message_attachment
  DROP CONSTRAINT IF EXISTS message_attachment_moderation_status_check;

ALTER TABLE message_attachment
  ADD CONSTRAINT message_attachment_moderation_status_check
  CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'failed'));
