CREATE TABLE legal_consent (
  id bigserial PRIMARY KEY,
  user_id integer REFERENCES "user"(id) ON DELETE SET NULL,
  registration_id varchar(128) NOT NULL,
  document_type varchar(32) NOT NULL
    CHECK (document_type IN ('user_agreement', 'personal_data', 'personal_data_dissemination')),
  document_version varchar(64) NOT NULL,
  document_sha256 char(64) NOT NULL CHECK (document_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  app_version varchar(64),
  source varchar(16) NOT NULL CHECK (source IN ('web', 'android')),
  revoked_at timestamptz,
  revocation_reason text
);

CREATE UNIQUE INDEX legal_consent_registration_active
  ON legal_consent (registration_id, document_type)
  WHERE revoked_at IS NULL AND user_id IS NULL;

CREATE UNIQUE INDEX legal_consent_user_active
  ON legal_consent (user_id, document_type)
  WHERE revoked_at IS NULL AND user_id IS NOT NULL;

CREATE INDEX legal_consent_user_history
  ON legal_consent (user_id, accepted_at DESC);

ALTER TABLE "user"
  ADD COLUMN public_profile_visible boolean NOT NULL DEFAULT false;

-- Existing hosts were already public before this gate existed. Preserve their
-- current visibility; every newly created account starts private.
UPDATE "user" u
SET public_profile_visible = true
WHERE EXISTS (
  SELECT 1 FROM house h WHERE h.owner_id = u.id AND h.deleted = false
);

CREATE TABLE data_retention_run (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status varchar(16) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);
