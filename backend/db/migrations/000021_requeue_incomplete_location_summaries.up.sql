-- Retry summaries that were interrupted while the previous worker version was
-- running. POIs are retained, while attempts are reset for the resilient worker.
UPDATE location_summary_job j
SET status = 'queued',
    attempts = 0,
    next_attempt_at = now(),
    last_error = NULL,
    revision = j.revision + 1,
    updated_at = now()
FROM house h
WHERE h.id = j.house_id
  AND h.deleted = false
  AND (
    COALESCE(jsonb_array_length(h.pois), 0) = 0
    OR NULLIF(BTRIM(h.location_summary), '') IS NULL
  );
