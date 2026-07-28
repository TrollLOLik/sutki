UPDATE message_attachment
SET moderation_status = 'pending',
    moderation_reason = NULL
WHERE moderation_status = 'failed';

UPDATE attachment_moderation_job job
SET status = 'queued',
    next_attempt_at = now(),
    decision = NULL,
    category = NULL,
    reason = NULL,
    confidence = NULL,
    frames_checked = NULL,
    last_error = NULL,
    updated_at = now()
FROM message_attachment attachment
WHERE attachment.id = job.attachment_id
  AND attachment.moderation_status = 'pending'
  AND job.decision = 'failed';

ALTER TABLE message_attachment
  DROP CONSTRAINT IF EXISTS message_attachment_moderation_status_check;

ALTER TABLE message_attachment
  ADD CONSTRAINT message_attachment_moderation_status_check
  CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
