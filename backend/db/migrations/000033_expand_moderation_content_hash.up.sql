-- ContentHash includes both the 64-character text hash and the 64-character
-- photo-list hash separated by a dot. The original varchar(64) column made
-- every new image-aware moderation enqueue fail after photo hashing was added.
ALTER TABLE moderation_verdict
  ALTER COLUMN content_hash TYPE text;

-- Pending listings created while the column was too short may have no queue
-- row at all. Seed a deliberately stale repair job. The worker will claim it,
-- notice that its hash differs from the current listing, and call Submit to
-- enqueue the real full-length hash through the normal code path.
INSERT INTO moderation_verdict
  (house_id, content_hash, source, status, next_attempt_at, last_error)
SELECT h.id,
       'repair-v33:' || h.id::text,
       'llm',
       'queued',
       now(),
       'repair pending listing that had no moderation job'
FROM house h
WHERE h.status = 'pending_moderation'
  AND h.deleted = false
  AND NOT EXISTS (
    SELECT 1
    FROM moderation_verdict mv
    WHERE mv.house_id = h.id
      AND mv.source = 'llm'
      AND mv.status IN ('queued', 'processing')
  )
ON CONFLICT DO NOTHING;

-- Existing old-format jobs are also due immediately. Their stale hash is
-- converted by the same worker path into a current full-length job.
UPDATE moderation_verdict mv
SET status = 'queued',
    next_attempt_at = now(),
    updated_at = now()
FROM house h
WHERE h.id = mv.house_id
  AND h.status = 'pending_moderation'
  AND h.deleted = false
  AND mv.source = 'llm'
  AND mv.status IN ('queued', 'processing');
