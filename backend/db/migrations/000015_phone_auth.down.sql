-- Drop phone_normalized from request
ALTER TABLE request DROP COLUMN IF EXISTS phone_normalized;

-- Drop indices
DROP INDEX IF EXISTS uniq_user_phone_normalized;
DROP INDEX IF EXISTS uniq_user_email_normalized;

-- Drop columns from user
ALTER TABLE "user" DROP COLUMN IF EXISTS phone_verified_at;
ALTER TABLE "user" DROP COLUMN IF EXISTS phone_normalized;

-- Re-add constraints to user (assuming clean rollback is possible, keeping it nullable is safer, but we can restore constraints if needed)
-- ALTER TABLE "user" ALTER COLUMN email SET NOT NULL;
-- ALTER TABLE "user" ADD CONSTRAINT user_email_key UNIQUE (email);

-- Drop auth_code table
DROP TABLE IF EXISTS auth_code;

-- Recreate email_login_code table
CREATE TABLE IF NOT EXISTS email_login_code (
  email varchar(255) PRIMARY KEY,
  code_hash varchar(255) NOT NULL,
  expires_at timestamp NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
