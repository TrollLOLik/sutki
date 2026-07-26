-- Reverts the 'reauth' purpose. Rows using it must go first, otherwise the
-- narrowed CHECK cannot be validated. They are short-lived one-time challenges,
-- so dropping them costs at most a retry for anyone mid-flow. Their deliveries
-- go with them: phone_auth_delivery.challenge_id is ON DELETE CASCADE
-- (migration 000016).
DELETE FROM phone_auth_challenge WHERE purpose = 'reauth';

ALTER TABLE phone_auth_challenge
  DROP CONSTRAINT IF EXISTS phone_auth_challenge_purpose_check;

ALTER TABLE phone_auth_challenge
  ADD CONSTRAINT phone_auth_challenge_purpose_check
  CHECK (purpose IN ('login', 'change_phone'));
