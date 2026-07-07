-- Revert listing moderation. Houses stuck in moderation states are
-- re-activated so the rollback does not hide listings.
UPDATE house SET status = 'active'
WHERE status IN ('pending_moderation', 'moderation_review');

DROP TABLE IF EXISTS photo_hash;
DROP TABLE IF EXISTS moderation_verdict;
