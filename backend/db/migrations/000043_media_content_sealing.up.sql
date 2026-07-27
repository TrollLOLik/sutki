-- Bind every registered chat upload to the immutable server-side snapshot
-- that is moderated and served. The original object_key remains the upload
-- capability and ownership identity; sealed_key is never client-writable.
ALTER TABLE chat_upload
  ADD COLUMN IF NOT EXISTS sealed_key text,
  ADD COLUMN IF NOT EXISTS content_etag text;

ALTER TABLE chat_upload
  DROP CONSTRAINT IF EXISTS chat_upload_seal_pair_check;

ALTER TABLE chat_upload
  ADD CONSTRAINT chat_upload_seal_pair_check CHECK (
    (sealed_key IS NULL AND content_etag IS NULL) OR
    (
      sealed_key IS NOT NULL AND length(sealed_key) > 0 AND
      content_etag IS NOT NULL AND length(content_etag) > 0
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS uniq_chat_upload_sealed_key
  ON chat_upload(sealed_key)
  WHERE sealed_key IS NOT NULL;
