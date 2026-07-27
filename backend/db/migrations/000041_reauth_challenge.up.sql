-- Durable storage for re-authentication attempts and the proofs they produce.
--
-- These used to live in a process-local sync.Map: lost on every restart,
-- invisible to a second replica, and impossible to make single-use atomically.
--
-- The row is created when the user STARTS re-authenticating, not when they
-- finish. That is what binds the operation: purpose and factor are decided by
-- the server at request time and read back from this row at verify time, so a
-- client cannot ask for a code "to change my email" and then present it as
-- authorization to change the phone. phone_challenge_id pins which flash-call
-- challenge the code must answer, for the same reason.
--
-- Only the SHA-256 of the proof token is stored, and only once the code has
-- been verified. The token itself is returned to the client exactly once, so a
-- database read — a dump, a backup, a compromised replica — yields nothing
-- spendable.
CREATE TABLE IF NOT EXISTS reauth_challenge (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  -- What this attempt will authorize, fixed at request time.
  purpose varchar(32) NOT NULL CHECK (purpose IN ('change_phone', 'change_email')),
  -- Which factor the user must prove, also fixed at request time and
  -- re-checked against the account at spend time.
  factor varchar(16) NOT NULL CHECK (factor IN ('phone', 'email')),
  -- The flash-call challenge this attempt answers. NULL for email re-auth.
  phone_challenge_id uuid REFERENCES phone_auth_challenge(id) ON DELETE CASCADE,
  -- NULL until the code is verified; then the SHA-256 of the proof token.
  token_hash varchar(64) UNIQUE,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- At most one live attempt per user, across both purposes.
--
-- Per-user rather than per-purpose on purpose: verification has to find "the
-- attempt this code belongs to" without being told, and two concurrent attempts
-- would make that ambiguous — which is exactly the ambiguity an attacker would
-- use to get a code issued for one operation accepted for another. Starting a
-- new re-authentication therefore cancels any attempt still in flight.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_reauth_challenge
  ON reauth_challenge(user_id)
  WHERE consumed_at IS NULL;

-- Reaper support. Rows are short-lived; without this the table grows forever.
CREATE INDEX IF NOT EXISTS idx_reauth_challenge_expires_at
  ON reauth_challenge(expires_at);
