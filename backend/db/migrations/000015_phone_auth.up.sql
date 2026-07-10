-- Drop table email_login_code
DROP TABLE IF EXISTS email_login_code;

-- Create auth_code table
CREATE TABLE IF NOT EXISTS auth_code (
  channel varchar(32) NOT NULL,
  target varchar(255) NOT NULL,
  code_hash varchar(255) NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivery_provider varchar(32),
  delivery_id varchar(128),
  delivery_cost varchar(32),
  PRIMARY KEY(channel, target)
);

-- Make email nullable on "user"
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_email_key;
ALTER TABLE "user" ALTER COLUMN email DROP NOT NULL;

-- Add phone columns to "user"
ALTER TABLE "user" ADD COLUMN phone_normalized varchar(32);
ALTER TABLE "user" ADD COLUMN phone_verified_at timestamptz;

-- Unique partial indexes on user email and phone_normalized
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_email_normalized
ON "user"(lower(email))
WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_phone_normalized
ON "user"(phone_normalized)
WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';

-- Add phone_normalized to "request" (guest request linking by phone)
ALTER TABLE request ADD COLUMN phone_normalized varchar(32);
