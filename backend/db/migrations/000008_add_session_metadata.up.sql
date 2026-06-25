ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS device_name varchar(255);
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS device_os varchar(64);
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS app_version varchar(32);
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS ip_address varchar(64);
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS location varchar(255);
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS last_active_at timestamp NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_refresh_token_user_active
  ON refresh_token (user_id)
  WHERE revoked_at IS NULL;
