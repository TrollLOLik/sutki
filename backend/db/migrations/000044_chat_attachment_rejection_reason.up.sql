ALTER TABLE message_attachment
  ADD COLUMN IF NOT EXISTS moderation_reason varchar(500);
