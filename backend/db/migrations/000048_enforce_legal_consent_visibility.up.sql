-- Migration 47 preserved legacy host visibility, but there is no defensible
-- consent record for those users. Fail closed until the owner explicitly
-- accepts the current dissemination document and republishes the listing.
UPDATE moderation_verdict verdict
SET status = 'failed',
    last_error = 'active data dissemination consent is missing',
    updated_at = now()
FROM house
WHERE verdict.house_id = house.id
  AND verdict.status IN ('queued', 'processing')
  AND NOT EXISTS (
    SELECT 1
    FROM legal_consent consent
    WHERE consent.user_id = house.owner_id
      AND consent.document_type = 'personal_data_dissemination'
      AND consent.revoked_at IS NULL
  );

UPDATE house
SET status = 'unpublished',
    rejection_reason = NULL,
    updated_at = now()
WHERE deleted = false
  AND status IN ('active', 'pending_moderation', 'moderation_review')
  AND NOT EXISTS (
    SELECT 1
    FROM legal_consent consent
    WHERE consent.user_id = house.owner_id
      AND consent.document_type = 'personal_data_dissemination'
      AND consent.revoked_at IS NULL
  );

UPDATE "user" account
SET public_profile_visible = false
WHERE account.public_profile_visible = true
  AND NOT EXISTS (
    SELECT 1
    FROM legal_consent consent
    WHERE consent.user_id = account.id
      AND consent.document_type = 'personal_data_dissemination'
      AND consent.revoked_at IS NULL
  );
