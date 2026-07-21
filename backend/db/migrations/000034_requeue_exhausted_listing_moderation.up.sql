-- Recover the latest technically failed LLM moderation job for listings that
-- still exist and can safely be checked again. Rejected listings are excluded:
-- a provider retry must never override a real moderation decision.
WITH latest_failed AS (
  SELECT DISTINCT ON (mv.house_id) mv.id
  FROM moderation_verdict mv
  JOIN house h ON h.id = mv.house_id
  WHERE mv.source = 'llm'
    AND mv.status = 'failed'
    AND mv.decision IS NULL
    AND h.deleted = false
    AND h.status IN ('pending_moderation', 'moderation_review', 'active')
  ORDER BY mv.house_id, mv.created_at DESC, mv.id DESC
)
UPDATE moderation_verdict mv
SET status = 'queued',
    next_attempt_at = now(),
    last_error = left(concat_ws('; ', mv.last_error, 'requeued by migration 000034'), 2000),
    updated_at = now()
FROM latest_failed lf
WHERE mv.id = lf.id;
