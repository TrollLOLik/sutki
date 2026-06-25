DROP INDEX IF EXISTS idx_refresh_token_user_active;

ALTER TABLE refresh_token DROP COLUMN IF EXISTS device_name;
ALTER TABLE refresh_token DROP COLUMN IF EXISTS device_os;
ALTER TABLE refresh_token DROP COLUMN IF EXISTS app_version;
ALTER TABLE refresh_token DROP COLUMN IF EXISTS ip_address;
ALTER TABLE refresh_token DROP COLUMN IF EXISTS location;
ALTER TABLE refresh_token DROP COLUMN IF EXISTS last_active_at;
