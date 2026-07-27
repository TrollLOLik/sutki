-- Durable ownership for chat uploads.
--
-- An owner id encoded in an object key is useful defence in depth, but it is
-- not proof that the server actually issued that key. The registry is created
-- together with the presigned upload target and is the authority used when a
-- message attaches the object.
CREATE TABLE IF NOT EXISTS chat_upload (
  object_key text PRIMARY KEY,
  -- A hard account deletion must not be blocked by old chat media. NULL means
  -- the former owner no longer exists; such a key cannot pass an ownership
  -- check or be attached again, while existing message refs remain readable.
  owner_id integer REFERENCES "user"(id) ON DELETE SET NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  mime_type varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_upload_owner_created
  ON chat_upload(owner_id, created_at DESC);

-- message_attachment is the reference table. Legacy rows stay NULL: their
-- historical owner cannot be established reliably, so they remain readable
-- but are never treated as safe candidates for automatic object deletion.
ALTER TABLE message_attachment
  ADD COLUMN IF NOT EXISTS upload_key text
    REFERENCES chat_upload(object_key) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_message_attachment_upload
  ON message_attachment(message_id, upload_key)
  WHERE upload_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_attachment_upload_key
  ON message_attachment(upload_key)
  WHERE upload_key IS NOT NULL;
