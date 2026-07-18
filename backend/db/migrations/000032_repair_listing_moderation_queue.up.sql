-- Repair rows affected by the old non-atomic moderation finalisation. If the
-- latest verdict is already done, apply it to a house that is still pending.
WITH latest_llm AS (
  SELECT DISTINCT ON (house_id)
         house_id, status, decision, reason, confidence
  FROM moderation_verdict
  WHERE source = 'llm'
  ORDER BY house_id, created_at DESC, id DESC
)
UPDATE house h
SET status = CASE
      WHEN v.decision = 'approve' THEN 'active'
      WHEN v.decision = 'reject' AND COALESCE(v.confidence, 0) >= 0.9 THEN 'rejected'
      ELSE 'moderation_review'
    END,
    rejection_reason = CASE
      WHEN v.decision = 'reject' AND COALESCE(v.confidence, 0) >= 0.9
        THEN NULLIF(left(COALESCE(v.reason, ''), 2000), '')
      ELSE NULL
    END,
    updated_at = now()
FROM latest_llm v
WHERE h.id = v.house_id
  AND h.status = 'pending_moderation'
  AND h.deleted = false
  AND v.status = 'done';

-- Retry pending jobs immediately under the fixed worker. This also recovers
-- failed/hourly-looping jobs from the previous implementation.
UPDATE moderation_verdict mv
SET status = 'queued',
    attempts = 0,
    next_attempt_at = now(),
    last_error = CASE
      WHEN mv.status = 'processing' THEN 'requeued during moderation queue repair'
      ELSE mv.last_error
    END,
    updated_at = now()
FROM house h
WHERE h.id = mv.house_id
  AND h.status = 'pending_moderation'
  AND h.deleted = false
  AND mv.source = 'llm'
  AND mv.status IN ('queued', 'processing', 'failed');

