CREATE TABLE admin_account (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE RESTRICT,
  role varchar(16) NOT NULL
    CHECK (role IN ('support', 'moderator', 'owner')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE INDEX admin_account_enabled_role_idx
  ON admin_account(role, id)
  WHERE enabled = true;

CREATE TABLE admin_session (
  id bigserial PRIMARY KEY,
  admin_account_id bigint NOT NULL REFERENCES admin_account(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  csrf_token_hash bytea NOT NULL,
  ip_address inet,
  user_agent varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX admin_session_account_active_idx
  ON admin_session(admin_account_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX admin_session_expiry_idx
  ON admin_session(expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE admin_audit_log (
  id bigserial PRIMARY KEY,
  actor_admin_id bigint NOT NULL REFERENCES admin_account(id) ON DELETE RESTRICT,
  action varchar(64) NOT NULL,
  target_type varchar(32),
  target_id varchar(128),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(action) BETWEEN 1 AND 64),
  CHECK (target_type IS NULL OR char_length(target_type) BETWEEN 1 AND 32),
  CHECK (target_id IS NULL OR char_length(target_id) BETWEEN 1 AND 128),
  CHECK (reason IS NULL OR char_length(reason) <= 2000)
);

CREATE INDEX admin_audit_log_actor_created_idx
  ON admin_audit_log(actor_admin_id, created_at DESC, id DESC);

CREATE INDEX admin_audit_log_target_created_idx
  ON admin_audit_log(target_type, target_id, created_at DESC, id DESC)
  WHERE target_type IS NOT NULL AND target_id IS NOT NULL;
