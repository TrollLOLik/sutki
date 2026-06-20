CREATE TABLE IF NOT EXISTS personal_data_revocation (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  revoked_at timestamp NOT NULL DEFAULT now(),
  email_hash varchar(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_personal_data_revocation_user_id ON personal_data_revocation(user_id);
