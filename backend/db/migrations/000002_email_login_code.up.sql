-- Email passwordless login: short-lived 6-digit codes (B1 auth).
-- Additive and idempotent. The legacy `code` table stores plaintext codes for
-- the old web app; we keep a separate, hashed table so codes are never stored
-- in clear and pre-registration emails (no user row yet) are supported.
CREATE TABLE IF NOT EXISTS email_login_code (
  email varchar(255) PRIMARY KEY,
  code_hash varchar(255) NOT NULL,
  expires_at timestamp NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
