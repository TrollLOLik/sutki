-- Mobile-app additions on top of the legacy web schema.
-- All statements are additive and idempotent; they never touch existing data.

-- 1. VK ID auth + avatar (legacy only had google_id / email+password).
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS vk_id varchar(255);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS avatar_url varchar(1200);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_vk_id ON "user" (vk_id) WHERE vk_id IS NOT NULL;

-- 2. Geo coordinates for the map screen (Yandex MapKit).
ALTER TABLE house ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE house ADD COLUMN IF NOT EXISTS lng double precision;

-- 3. Refresh tokens (JWT access/refresh rotation).
CREATE TABLE IF NOT EXISTS refresh_token (
  id BIGSERIAL PRIMARY KEY,
  user_id integer NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  token_hash varchar(255) NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  revoked_at timestamp DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_token_user ON refresh_token (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_refresh_token_hash ON refresh_token (token_hash);

-- 4. Favorites ("Избранное" tab).
CREATE TABLE IF NOT EXISTS favorite (
  id BIGSERIAL PRIMARY KEY,
  user_id integer NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  house_id integer NOT NULL REFERENCES house (id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (user_id, house_id)
);

-- 5. Push device tokens (RuStore / FCM / APNs).
CREATE TABLE IF NOT EXISTS device_token (
  id BIGSERIAL PRIMARY KEY,
  user_id integer NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  token varchar(500) NOT NULL,
  platform varchar(16) NOT NULL,
  provider varchar(16) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (token)
);
CREATE INDEX IF NOT EXISTS idx_device_token_user ON device_token (user_id);

-- 6. Realtime chat ("Сообщения" tab, delivered via Centrifugo).
CREATE TABLE IF NOT EXISTS conversation (
  id BIGSERIAL PRIMARY KEY,
  house_id integer REFERENCES house (id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS conversation_participant (
  conversation_id bigint NOT NULL REFERENCES conversation (id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  last_read_at timestamp DEFAULT NULL,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS message (
  id BIGSERIAL PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES conversation (id) ON DELETE CASCADE,
  sender_id integer NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  body varchar(4000) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_conversation ON message (conversation_id, created_at);

-- 7. Payments (YooKassa) for bookings.
CREATE TABLE IF NOT EXISTS payment (
  id BIGSERIAL PRIMARY KEY,
  request_id integer REFERENCES request (id) ON DELETE SET NULL,
  user_id integer REFERENCES "user" (id) ON DELETE SET NULL,
  provider varchar(32) NOT NULL DEFAULT 'yookassa',
  provider_payment_id varchar(255),
  amount_kopecks integer NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'RUB',
  status varchar(32) NOT NULL DEFAULT 'pending',
  confirmation_url varchar(1200),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  paid_at timestamp DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_request ON payment (request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_provider_id ON payment (provider_payment_id) WHERE provider_payment_id IS NOT NULL;
