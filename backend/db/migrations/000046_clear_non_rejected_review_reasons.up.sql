UPDATE review
SET rejection_reason = NULL
WHERE status <> 'rejected'
  AND rejection_reason IS NOT NULL;

UPDATE review_reply
SET rejection_reason = NULL
WHERE status <> 'rejected'
  AND rejection_reason IS NOT NULL;
