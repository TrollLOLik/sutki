CREATE TABLE phone_auth_challenge (
  id uuid PRIMARY KEY,
  phone_normalized varchar(32) NOT NULL,
  purpose varchar(32) NOT NULL CHECK (purpose IN ('login', 'change_phone')),
  user_id integer REFERENCES "user"(id) ON DELETE CASCADE,
  code_hash varchar(255),
  code_length integer NOT NULL DEFAULT 4,
  status varchar(32) NOT NULL CHECK (status IN (
    'delivery_pending', 'ready_for_verification', 'verified', 'delivery_failed', 'expired'
  )),
  delivery_mode varchar(32) NOT NULL CHECK (delivery_mode IN ('flash_call', 'voice')),
  pending_until timestamptz,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_active_phone_challenge
ON phone_auth_challenge(phone_normalized, purpose)
WHERE status IN ('delivery_pending', 'ready_for_verification');

CREATE INDEX idx_phone_auth_challenge_pending
ON phone_auth_challenge(pending_until)
WHERE status = 'delivery_pending';

CREATE TABLE phone_auth_delivery (
  id bigserial PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES phone_auth_challenge(id) ON DELETE CASCADE,
  provider varchar(32) NOT NULL,
  mode varchar(32) NOT NULL CHECK (mode IN ('flash_call', 'voice')),
  idempotency_id uuid NOT NULL UNIQUE,
  provider_delivery_id varchar(128),
  status varchar(32) NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error_code varchar(64),
  error_message varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_auth_delivery_challenge
ON phone_auth_delivery(challenge_id, created_at DESC);
