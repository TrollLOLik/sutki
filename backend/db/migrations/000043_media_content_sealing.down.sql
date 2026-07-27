DROP INDEX IF EXISTS uniq_chat_upload_sealed_key;

ALTER TABLE chat_upload
  DROP CONSTRAINT IF EXISTS chat_upload_seal_pair_check,
  DROP COLUMN IF EXISTS content_etag,
  DROP COLUMN IF EXISTS sealed_key;
