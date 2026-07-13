DROP TABLE IF EXISTS review_summary_job;
DROP TABLE IF EXISTS review_moderation_job;
DROP TABLE IF EXISTS review_reply;
DROP INDEX IF EXISTS review_author_status_idx;
DROP INDEX IF EXISTS review_one_per_request;
ALTER TABLE review
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS moderated_at,
  DROP COLUMN IF EXISTS content_hash,
  DROP COLUMN IF EXISTS published_body,
  DROP COLUMN IF EXISTS original_body,
  DROP COLUMN IF EXISTS request_id;
