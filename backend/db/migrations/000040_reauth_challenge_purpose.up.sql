-- Adds the 'reauth' challenge purpose.
--
-- Rebinding a login factor (phone or email) now requires proving control of a
-- factor already on the account. For accounts whose current factor is a phone,
-- that proof is a flash call, and it needs its own purpose: the partial unique
-- index uniq_active_phone_challenge is on (phone_normalized, purpose), so
-- reusing 'login' would make a live login challenge and a live re-auth
-- challenge on the same number collide, and would let a code minted for one
-- flow be replayed against the other.
ALTER TABLE phone_auth_challenge
  DROP CONSTRAINT IF EXISTS phone_auth_challenge_purpose_check;

ALTER TABLE phone_auth_challenge
  ADD CONSTRAINT phone_auth_challenge_purpose_check
  CHECK (purpose IN ('login', 'change_phone', 'reauth'));
