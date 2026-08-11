-- WIGAJ Arenda: complete PostgreSQL schema
-- Generated from db/baseline/schema.sql and every db/migrations/*.up.sql.
-- Includes migrations 000001 through 000034.
--
-- Apply ONLY to a clean, empty database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/complete_schema.sql
--
-- This is schema/reference-data bootstrap, not a production data backup.
-- After import, golang-migrate continues from the next migration version.

BEGIN;

-- ============================================================================
-- Baseline schema
-- ============================================================================

-- Baseline schema for the existing 'sutki' database (legacy web project, Symfony/Doctrine).
-- This reflects what already exists in production (Timeweb) / the converted dump.
-- All statements are idempotent (IF NOT EXISTS) so this is safe to run against an existing DB.
-- Mobile-specific additions live in db/migrations/. No production data is stored here.
-- NOTE: the original converted dump relies on MySQL-style escaping; load data with
--       'SET standard_conforming_strings = off;' if importing the legacy dump.

-- Table structures
CREATE TABLE IF NOT EXISTS admin_story (
  id SERIAL,
  admin_id integer NOT NULL,
  category_id integer DEFAULT NULL,
  service_id integer DEFAULT NULL,
  change_date timestamp NOT NULL,
  type varchar(255)  NOT NULL,
  user_id integer DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS code (
  id SERIAL,
  email varchar(255)  NOT NULL,
  code varchar(6)  NOT NULL,
  date timestamp NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS comment (
  id SERIAL,
  owner_id integer NOT NULL,
  house_id integer NOT NULL,
  parent_id integer DEFAULT NULL,
  addressee_id integer DEFAULT NULL,
  body varchar(2000)  NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS doctrine_migration_versions (
  version varchar(191)  NOT NULL,
  executed_at timestamp DEFAULT NULL,
  execution_time integer DEFAULT NULL,
  PRIMARY KEY (version)
);

CREATE TABLE IF NOT EXISTS file (
  id SERIAL,
  house_id integer DEFAULT NULL,
  name varchar(255)  NOT NULL,
  size integer DEFAULT NULL,
  format varchar(255)  NOT NULL,
  dir varchar(255)  DEFAULT NULL,
  path varchar(1200)  NOT NULL,
  deleted boolean NOT NULL,
  position integer NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS guest (
  id SERIAL,
  guest_id integer NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS house (
  id SERIAL,
  owner_id integer NOT NULL,
  street varchar(255)  NOT NULL,
  description varchar(5005)  NOT NULL,
  price integer NOT NULL,
  deleted boolean NOT NULL,
  count_room varchar(255)  NOT NULL,
  status varchar(255)  NOT NULL DEFAULT 'new',
  country varchar(255)  NOT NULL DEFAULT 'Магнитогорск',
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  views integer NOT NULL DEFAULT '0',
  last_date_view timestamp DEFAULT NULL,
  views_current_day integer DEFAULT NULL,
  date_top timestamp DEFAULT NULL,
  pay boolean NOT NULL DEFAULT false,
  house_number varchar(50)  NOT NULL,
  area integer NOT NULL,
  number_room varchar(100)  DEFAULT NULL,
  rejection_reason varchar(2000)  DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS house_category (
  id SERIAL,
  name varchar(255)  NOT NULL,
  deleted boolean NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS house_house_category (
  house_id integer NOT NULL,
  house_category_id integer NOT NULL,
  PRIMARY KEY (house_id, house_category_id)
);

CREATE TABLE IF NOT EXISTS house_house_service (
  house_id integer NOT NULL,
  service_id integer NOT NULL,
  PRIMARY KEY (house_id, service_id)
);

CREATE TABLE IF NOT EXISTS request (
  id SERIAL,
  house_id integer DEFAULT NULL,
  user_id integer DEFAULT NULL,
  name varchar(255)  NOT NULL,
  surname varchar(255)  NOT NULL,
  lastname varchar(255)  NOT NULL,
  count integer NOT NULL,
  message varchar(800)  DEFAULT NULL,
  phone varchar(255)  NOT NULL,
  start_date date NOT NULL,
  end_date date DEFAULT NULL,
  status varchar(255)  NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  confirmed_at timestamp DEFAULT NULL,
  rejection_reason varchar(2000)  DEFAULT NULL,
  guest_id varchar(255)  DEFAULT NULL,
  email varchar(255)  DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS request_viewers (
  id SERIAL,
  request_id integer NOT NULL,
  user_id integer DEFAULT NULL,
  guest_id varchar(255)  DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS review (
  id SERIAL,
  owner_id integer NOT NULL,
  house_id integer NOT NULL,
  body varchar(1500)  NOT NULL,
  rating integer NOT NULL,
  status varchar(255)  NOT NULL,
  rejection_reason varchar(2000)  DEFAULT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS service (
  id SERIAL,
  name varchar(255)  NOT NULL,
  deleted boolean NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS session_ip_address (
  id SERIAL,
  uid varchar(255)  NOT NULL,
  city varchar(255)  NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "user" (
  id SERIAL,
  name varchar(255)  DEFAULT NULL,
  surname varchar(255)  DEFAULT NULL,
  patronymic varchar(255)  DEFAULT NULL,
  email varchar(255)  NOT NULL,
  password varchar(500)  DEFAULT NULL,
  roles jsonb NOT NULL,
  deleted boolean NOT NULL,
  is_verified boolean NOT NULL,
  google_id varchar(255)  DEFAULT NULL,
  phone varchar(255)  DEFAULT NULL,
  locale varchar(255)  DEFAULT NULL,
  city varchar(255)  DEFAULT NULL,
  enable boolean NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  code varchar(6)  DEFAULT NULL,
  date_code timestamp DEFAULT NULL,
  rejection_reason varchar(2000)  DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS views (
  id SERIAL,
  value bigint DEFAULT NULL,
  view_date timestamp NOT NULL,
  PRIMARY KEY (id)
);

-- Table indexes
CREATE INDEX IF NOT EXISTS IDX_4B7CFFC2642B8210 ON admin_story (admin_id);
CREATE INDEX IF NOT EXISTS IDX_4B7CFFC212469DE2 ON admin_story (category_id);
CREATE INDEX IF NOT EXISTS IDX_4B7CFFC2ED5CA9E6 ON admin_story (service_id);
CREATE INDEX IF NOT EXISTS IDX_4B7CFFC2A76ED395 ON admin_story (user_id);
CREATE INDEX IF NOT EXISTS IDX_9474526C7E3C61F9 ON comment (owner_id);
CREATE INDEX IF NOT EXISTS IDX_9474526C6BB74515 ON comment (house_id);
CREATE INDEX IF NOT EXISTS IDX_9474526C727ACA70 ON comment (parent_id);
CREATE INDEX IF NOT EXISTS IDX_9474526C2261B4C3 ON comment (addressee_id);
CREATE INDEX IF NOT EXISTS IDX_8C9F36106BB74515 ON file (house_id);
CREATE INDEX IF NOT EXISTS IDX_67D5399D7E3C61F9 ON house (owner_id);
CREATE INDEX IF NOT EXISTS IDX_A2C97DEF6BB74515 ON house_house_category (house_id);
CREATE INDEX IF NOT EXISTS IDX_A2C97DEF6C967117 ON house_house_category (house_category_id);
CREATE INDEX IF NOT EXISTS IDX_B53DD9B46BB74515 ON house_house_service (house_id);
CREATE INDEX IF NOT EXISTS IDX_B53DD9B4ED5CA9E6 ON house_house_service (service_id);
CREATE INDEX IF NOT EXISTS IDX_3B978F9F6BB74515 ON request (house_id);
CREATE INDEX IF NOT EXISTS IDX_3B978F9FA76ED395 ON request (user_id);
CREATE INDEX IF NOT EXISTS IDX_2A28448B427EB8A5 ON request_viewers (request_id);
CREATE INDEX IF NOT EXISTS IDX_2A28448BA76ED395 ON request_viewers (user_id);
CREATE INDEX IF NOT EXISTS IDX_794381C67E3C61F9 ON review (owner_id);
CREATE INDEX IF NOT EXISTS IDX_794381C66BB74515 ON review (house_id);

-- Foreign key constraints
ALTER TABLE admin_story ADD CONSTRAINT FK_4B7CFFC212469DE2 FOREIGN KEY (category_id) REFERENCES house_category (id) ON DELETE CASCADE;
ALTER TABLE admin_story ADD CONSTRAINT FK_4B7CFFC2642B8210 FOREIGN KEY (admin_id) REFERENCES "user" (id) ON DELETE CASCADE;
ALTER TABLE admin_story ADD CONSTRAINT FK_4B7CFFC2A76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE;
ALTER TABLE admin_story ADD CONSTRAINT FK_4B7CFFC2ED5CA9E6 FOREIGN KEY (service_id) REFERENCES service (id) ON DELETE CASCADE;
ALTER TABLE comment ADD CONSTRAINT FK_9474526C2261B4C3 FOREIGN KEY (addressee_id) REFERENCES "user" (id);
ALTER TABLE comment ADD CONSTRAINT FK_9474526C6BB74515 FOREIGN KEY (house_id) REFERENCES house (id);
ALTER TABLE comment ADD CONSTRAINT FK_9474526C727ACA70 FOREIGN KEY (parent_id) REFERENCES comment (id);
ALTER TABLE comment ADD CONSTRAINT FK_9474526C7E3C61F9 FOREIGN KEY (owner_id) REFERENCES "user" (id);
ALTER TABLE file ADD CONSTRAINT FK_8C9F36106BB74515 FOREIGN KEY (house_id) REFERENCES house (id);
ALTER TABLE house ADD CONSTRAINT FK_67D5399D7E3C61F9 FOREIGN KEY (owner_id) REFERENCES "user" (id);
ALTER TABLE house_house_category ADD CONSTRAINT FK_A2C97DEF6BB74515 FOREIGN KEY (house_id) REFERENCES house (id) ON DELETE CASCADE;
ALTER TABLE house_house_category ADD CONSTRAINT FK_A2C97DEF6C967117 FOREIGN KEY (house_category_id) REFERENCES house_category (id) ON DELETE CASCADE;
ALTER TABLE house_house_service ADD CONSTRAINT FK_B53DD9B46BB74515 FOREIGN KEY (house_id) REFERENCES house (id) ON DELETE CASCADE;
ALTER TABLE house_house_service ADD CONSTRAINT FK_B53DD9B4ED5CA9E6 FOREIGN KEY (service_id) REFERENCES service (id) ON DELETE CASCADE;
ALTER TABLE request ADD CONSTRAINT FK_3B978F9F6BB74515 FOREIGN KEY (house_id) REFERENCES house (id);
ALTER TABLE request ADD CONSTRAINT FK_3B978F9FA76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id);
ALTER TABLE request_viewers ADD CONSTRAINT FK_2A28448B427EB8A5 FOREIGN KEY (request_id) REFERENCES request (id);
ALTER TABLE request_viewers ADD CONSTRAINT FK_2A28448BA76ED395 FOREIGN KEY (user_id) REFERENCES "user" (id);
ALTER TABLE review ADD CONSTRAINT FK_794381C66BB74515 FOREIGN KEY (house_id) REFERENCES house (id);
ALTER TABLE review ADD CONSTRAINT FK_794381C67E3C61F9 FOREIGN KEY (owner_id) REFERENCES "user" (id);


-- ============================================================================
-- Migration: 000001_mobile_additions.up.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 000002_email_login_code.up.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 000003_review_created_at.up.sql
-- ============================================================================

-- Reviews need a timestamp so the mobile reviews list can sort and display
-- "когда" (e.g. "12 мая 2024"). The legacy `review` table has no time column;
-- this is an additive, idempotent change that backfills existing rows to now().
ALTER TABLE review ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();


-- ============================================================================
-- Migration: 000004_add_user_birthday.up.sql
-- ============================================================================

-- Migration to add birthday column to the user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS birthday date DEFAULT NULL;


-- ============================================================================
-- Migration: 000005_add_house_max_guests.up.sql
-- ============================================================================

-- Add max_guests (sleeping capacity) to house. Nullable: legacy rows keep NULL
-- ("capacity unknown") and are not excluded by the guests filter.
ALTER TABLE house ADD COLUMN IF NOT EXISTS max_guests integer DEFAULT NULL;


-- ============================================================================
-- Migration: 000006_add_personal_data_revocations.up.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS personal_data_revocation (
  id serial PRIMARY KEY,
  user_id integer NOT NULL,
  revoked_at timestamp NOT NULL DEFAULT now(),
  email_hash varchar(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_personal_data_revocation_user_id ON personal_data_revocation(user_id);


-- ============================================================================
-- Migration: 000007_add_house_rules.up.sql
-- ============================================================================

-- Add check-in / check-out times and rules enums to house table.
ALTER TABLE house ADD COLUMN IF NOT EXISTS check_in_after time DEFAULT NULL;
ALTER TABLE house ADD COLUMN IF NOT EXISTS check_out_before time DEFAULT NULL;
ALTER TABLE house ADD COLUMN IF NOT EXISTS smoking_allowed varchar(50) DEFAULT NULL;
ALTER TABLE house ADD COLUMN IF NOT EXISTS pets_allowed varchar(50) DEFAULT NULL;
ALTER TABLE house ADD COLUMN IF NOT EXISTS children_allowed varchar(50) DEFAULT NULL;
ALTER TABLE house ADD COLUMN IF NOT EXISTS events_allowed varchar(50) DEFAULT NULL;

ALTER TABLE house ADD CONSTRAINT chk_smoking
  CHECK (smoking_allowed IS NULL OR smoking_allowed IN ('allowed', 'forbidden', 'on_balcony'));

ALTER TABLE house ADD CONSTRAINT chk_pets
  CHECK (pets_allowed IS NULL OR pets_allowed IN ('allowed', 'forbidden', 'on_request'));

ALTER TABLE house ADD CONSTRAINT chk_children
  CHECK (children_allowed IS NULL OR children_allowed IN ('allowed', 'forbidden', 'on_request'));

ALTER TABLE house ADD CONSTRAINT chk_events
  CHECK (events_allowed IS NULL OR events_allowed IN ('allowed', 'forbidden', 'on_request'));


-- ============================================================================
-- Migration: 000008_add_session_metadata.up.sql
-- ============================================================================

ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS device_name varchar(255);
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS device_os varchar(64);
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS app_version varchar(32);
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS ip_address varchar(64);
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS location varchar(255);
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS last_active_at timestamp NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_refresh_token_user_active
  ON refresh_token (user_id)
  WHERE revoked_at IS NULL;


-- ============================================================================
-- Migration: 000009_chat_additions.up.sql
-- ============================================================================

-- 1. Index for optimizing listing of conversations (eliminate seq scan)
CREATE INDEX IF NOT EXISTS idx_conversation_participant_user_id ON conversation_participant(user_id);

-- 2. New message_attachment table for multiple attachments support
CREATE TABLE IF NOT EXISTS message_attachment (
  id            BIGSERIAL PRIMARY KEY,
  message_id    bigint NOT NULL REFERENCES message(id) ON DELETE CASCADE,
  url           text NOT NULL,
  file_name     varchar(500),
  mime_type     varchar(100),
  size_bytes    bigint,
  width         int,
  height        int,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_attachment_message ON message_attachment(message_id);

-- 3. Modify message table to make body nullable
ALTER TABLE message ALTER COLUMN body DROP NOT NULL;

-- 4. Tracking last read message in conversation
ALTER TABLE conversation_participant ADD COLUMN IF NOT EXISTS last_read_message_id bigint;

-- 5. Convert relevant timestamp columns to timestamptz for timezone safety
ALTER TABLE conversation ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE conversation ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE conversation_participant ALTER COLUMN last_read_at TYPE timestamptz USING last_read_at AT TIME ZONE 'UTC';
ALTER TABLE message ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';


-- ============================================================================
-- Migration: 000010_add_reviews_summary.up.sql
-- ============================================================================

ALTER TABLE house ADD COLUMN IF NOT EXISTS reviews_summary text DEFAULT NULL;
ALTER TABLE house ADD COLUMN IF NOT EXISTS location_summary text DEFAULT NULL;


-- ============================================================================
-- Migration: 000011_email_outbox.up.sql
-- ============================================================================

-- email_outbox is the persistent queue (transactional outbox) for all
-- application emails. Rows are the source of truth: the in-process worker
-- polls this table, so queued mail survives restarts/deploys and failed
-- sends are retried with backoff.
--
-- dedup_key is NULL for repeatable transactional mail (login codes) and a
-- unique event key (e.g. 'booking_confirmed:42') for one-shot notifications,
-- so a double Confirm click can never send two emails.
CREATE TABLE IF NOT EXISTS email_outbox (
  id BIGSERIAL PRIMARY KEY,
  dedup_key TEXT UNIQUE,
  user_id INTEGER,
  recipient TEXT NOT NULL,
  event_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  -- Bodies are nulled out after a successful send so plaintext login codes
  -- and personal data do not accumulate in the table.
  body_text TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Partial index keeps the worker's poll query cheap regardless of history size.
CREATE INDEX IF NOT EXISTS email_outbox_pending_idx
  ON email_outbox (next_attempt_at)
  WHERE status = 'queued';

-- For pruning old delivered/failed rows.
CREATE INDEX IF NOT EXISTS email_outbox_created_at_idx
  ON email_outbox (created_at);


-- ============================================================================
-- Migration: 000012_email_preferences.up.sql
-- ============================================================================

-- Per-user opt-outs for non-transactional email categories.
-- Transactional mail (login codes, booking confirmed/rejected for the tenant)
-- is NOT gated by this table. A missing row means "all defaults".
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id     integer PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  -- Owner-side booking activity (new request, tenant cancelled).
  booking     boolean NOT NULL DEFAULT true,
  -- "New message while you were away" chat notifications.
  chat_digest boolean NOT NULL DEFAULT true,
  -- "You received a review" notifications (phase 3).
  reviews     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- Migration: 000013_message_kinds.up.sql
-- ============================================================================

-- System chat messages (booking status cards). kind='user' for normal
-- messages, kind='booking_status' for server-posted booking event cards.
-- payload holds the machine-readable card data (request_id, event, dates...).
-- sender_id becomes nullable: system messages have no sender. body stays
-- NOT NULL and carries a human-readable fallback so old clients render
-- system cards as plain incoming text instead of breaking.
ALTER TABLE message
    ALTER COLUMN sender_id DROP NOT NULL,
    ADD COLUMN kind varchar(32) NOT NULL DEFAULT 'user',
    ADD COLUMN payload jsonb;

-- Dedup guard: at most one card per (conversation, request, event). Retries
-- and concurrent transitions cannot produce duplicate cards.
CREATE UNIQUE INDEX uniq_message_booking_event
    ON message (conversation_id, ((payload ->> 'request_id')), ((payload ->> 'event')))
    WHERE kind = 'booking_status';


-- ============================================================================
-- Migration: 000014_listing_moderation.up.sql
-- ============================================================================

-- Listing moderation: LLM verdict queue + audit trail, and photo perceptual
-- hashes for duplicate detection. House gains no new columns: the existing
-- status varchar and rejection_reason are reused.
--   house.status values after this migration:
--     'active'              — publicly visible (unchanged)
--     'pending_moderation'  — awaiting prefilter/LLM verdict, hidden
--     'moderation_review'   — needs a human decision, hidden
--     'rejected'            — moderation rejected, hidden, reason in rejection_reason
--     'new'                 — legacy default, treated as hidden (unchanged)

CREATE TABLE IF NOT EXISTS moderation_verdict (
  id bigserial PRIMARY KEY,
  house_id int NOT NULL REFERENCES house (id) ON DELETE CASCADE,
  -- sha256 of the moderated text bundle; dedups repeat LLM calls on
  -- unchanged content and lets updates carry verdicts over.
  content_hash varchar(64) NOT NULL,
  source varchar(16) NOT NULL,           -- prefilter | llm | human
  decision varchar(16),                  -- approve | reject | review (NULL until processed)
  category varchar(64),                  -- e.g. contacts, scam, prohibited, duplicate, stolen_photos, flagged_user
  reason varchar(2000),
  confidence real,
  raw_response jsonb,                    -- raw LLM output for audit
  moderator_id int REFERENCES "user" (id) ON DELETE SET NULL, -- set when source='human'
  -- queue machinery (mirrors email_outbox)
  status varchar(16) NOT NULL DEFAULT 'queued',  -- queued | processing | done | failed
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error varchar(2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One pending LLM job per house+content; re-submits of identical text no-op.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_moderation_llm_content
  ON moderation_verdict (house_id, content_hash)
  WHERE source = 'llm';

-- Worker poll: due queued/processing jobs.
CREATE INDEX IF NOT EXISTS idx_moderation_due
  ON moderation_verdict (next_attempt_at)
  WHERE status IN ('queued', 'processing');

-- Human review queue + per-owner reject counting.
CREATE INDEX IF NOT EXISTS idx_moderation_house ON moderation_verdict (house_id, created_at DESC);

-- Perceptual hashes of listing photos for internal duplicate detection.
CREATE TABLE IF NOT EXISTS photo_hash (
  id bigserial PRIMARY KEY,
  house_id int NOT NULL REFERENCES house (id) ON DELETE CASCADE,
  media_key varchar(500) NOT NULL,
  phash bigint NOT NULL,                 -- 64-bit perceptual hash
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (house_id, media_key)
);

CREATE INDEX IF NOT EXISTS idx_photo_hash_phash ON photo_hash (phash);


-- ============================================================================
-- Migration: 000015_phone_auth.up.sql
-- ============================================================================

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
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Unique partial indexes on user email and phone_normalized
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_email_normalized
ON "user"(lower(email))
WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_phone_normalized
ON "user"(phone_normalized)
WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';

-- Add phone_normalized to "request" (guest request linking by phone)
ALTER TABLE request ADD COLUMN phone_normalized varchar(32);


-- ============================================================================
-- Migration: 000016_ucaller_phone_challenges.up.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 000017_location_summary_job.up.sql
-- ============================================================================

-- Add POIs column to house table and create location_summary_job table.
ALTER TABLE house ADD COLUMN IF NOT EXISTS pois jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS location_summary_job (
  id bigserial PRIMARY KEY,
  house_id int NOT NULL REFERENCES house (id) ON DELETE CASCADE,
  city varchar(255) NOT NULL,
  street varchar(255) NOT NULL,
  pois jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(16) NOT NULL DEFAULT 'queued', -- queued | processing | done | failed
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error varchar(2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_summary_due
  ON location_summary_job (next_attempt_at)
  WHERE status IN ('queued', 'processing');


-- ============================================================================
-- Migration: 000018_location_summary_job_revision.up.sql
-- ============================================================================

-- Keep exactly one current enrichment job per house. Existing duplicate jobs
-- can be stale after an address change, so preserve the newest one only.
DELETE FROM location_summary_job older
USING location_summary_job newer
WHERE older.house_id = newer.house_id
  AND older.id < newer.id;

ALTER TABLE location_summary_job
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

ALTER TABLE location_summary_job
  ADD CONSTRAINT location_summary_job_house_id_key UNIQUE (house_id);


-- ============================================================================
-- Migration: 000019_backfill_location_enrichment.up.sql
-- ============================================================================

-- Re-enrich existing houses whose legacy jobs completed with empty POIs or an
-- empty LLM response. Houses without exact coordinates are intentionally skipped.
INSERT INTO location_summary_job (
  house_id, city, street, lat, lng, pois, status, attempts, next_attempt_at, revision
)
SELECT
  h.id,
  h.country,
  h.street,
  h.lat,
  h.lng,
  COALESCE(h.pois, '[]'::jsonb),
  'queued',
  0,
  now(),
  1
FROM house h
WHERE h.deleted = false
  AND h.lat IS NOT NULL
  AND h.lng IS NOT NULL
  AND (
    h.location_summary IS NULL
    OR btrim(h.location_summary) = ''
    OR COALESCE(jsonb_array_length(h.pois), 0) = 0
  )
ON CONFLICT (house_id) DO UPDATE SET
  city = EXCLUDED.city,
  street = EXCLUDED.street,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  pois = EXCLUDED.pois,
  status = 'queued',
  attempts = 0,
  next_attempt_at = now(),
  last_error = NULL,
  revision = location_summary_job.revision + 1,
  updated_at = now();


-- ============================================================================
-- Migration: 000020_requeue_empty_location_enrichment.up.sql
-- ============================================================================

-- Requeue houses completed by the pre-POI worker. This migration is safe to
-- run after deploying the worker that understands lat/lng and revisions.
INSERT INTO location_summary_job (
  house_id, city, street, lat, lng, pois, status, attempts, next_attempt_at, revision
)
SELECT
  h.id,
  h.country,
  h.street,
  h.lat,
  h.lng,
  COALESCE(h.pois, '[]'::jsonb),
  'queued',
  0,
  now(),
  1
FROM house h
WHERE h.deleted = false
  AND h.lat IS NOT NULL
  AND h.lng IS NOT NULL
  AND COALESCE(jsonb_array_length(h.pois), 0) = 0
ON CONFLICT (house_id) DO UPDATE SET
  city = EXCLUDED.city,
  street = EXCLUDED.street,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  pois = EXCLUDED.pois,
  status = 'queued',
  attempts = 0,
  next_attempt_at = now(),
  last_error = NULL,
  revision = location_summary_job.revision + 1,
  updated_at = now();


-- ============================================================================
-- Migration: 000021_requeue_incomplete_location_summaries.up.sql
-- ============================================================================

-- Retry summaries that were interrupted while the previous worker version was
-- running. POIs are retained, while attempts are reset for the resilient worker.
UPDATE location_summary_job j
SET status = 'queued',
    attempts = 0,
    next_attempt_at = now(),
    last_error = NULL,
    revision = j.revision + 1,
    updated_at = now()
FROM house h
WHERE h.id = j.house_id
  AND h.deleted = false
  AND (
    COALESCE(jsonb_array_length(h.pois), 0) = 0
    OR NULLIF(BTRIM(h.location_summary), '') IS NULL
  );


-- ============================================================================
-- Migration: 000022_payment_platform.up.sql
-- ============================================================================

ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS purpose varchar(32) NOT NULL DEFAULT 'booking',
  ADD COLUMN IF NOT EXISTS product_code varchar(64),
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS description varchar(255),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_amount_kopecks integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_idempotency_key
  ON payment (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_user_created
  ON payment (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_product (
  code varchar(64) PRIMARY KEY,
  title varchar(128) NOT NULL,
  purpose varchar(32) NOT NULL,
  amount_kopecks integer NOT NULL CHECK (amount_kopecks > 0),
  currency varchar(3) NOT NULL DEFAULT 'RUB',
  vat_code smallint NOT NULL CHECK (vat_code BETWEEN 1 AND 6),
  payment_subject varchar(32) NOT NULL DEFAULT 'service',
  payment_mode varchar(32) NOT NULL DEFAULT 'full_payment',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO payment_product
  (code, title, purpose, amount_kopecks, currency, vat_code, payment_subject, payment_mode)
VALUES
  ('listing_publication', 'Публикация объявления', 'publication', 19900, 'RUB', 1, 'service', 'full_payment')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS payment_webhook_event (
  id bigserial PRIMARY KEY,
  provider varchar(32) NOT NULL,
  event_type varchar(64) NOT NULL,
  provider_object_id varchar(255) NOT NULL,
  dedup_key varchar(512) NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_due
  ON payment_webhook_event (next_attempt_at, id)
  WHERE status IN ('queued', 'processing');

CREATE TABLE IF NOT EXISTS payment_refund (
  id bigserial PRIMARY KEY,
  payment_id bigint NOT NULL REFERENCES payment(id) ON DELETE RESTRICT,
  provider_refund_id varchar(255),
  idempotency_key uuid NOT NULL UNIQUE,
  amount_kopecks integer NOT NULL CHECK (amount_kopecks > 0),
  currency varchar(3) NOT NULL DEFAULT 'RUB',
  status varchar(32) NOT NULL DEFAULT 'pending',
  reason varchar(255) NOT NULL,
  initiated_by integer REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  succeeded_at timestamptz,
  canceled_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_refund_provider_id
  ON payment_refund (provider_refund_id) WHERE provider_refund_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_receipt (
  id bigserial PRIMARY KEY,
  payment_id bigint NOT NULL REFERENCES payment(id) ON DELETE RESTRICT,
  refund_id bigint REFERENCES payment_refund(id) ON DELETE RESTRICT,
  operation varchar(32) NOT NULL CHECK (operation IN ('payment', 'refund')),
  provider_receipt_id varchar(255),
  status varchar(32) NOT NULL DEFAULT 'pending',
  customer_contact_masked varchar(255),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  registered_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_receipt_provider_id
  ON payment_receipt (provider_receipt_id) WHERE provider_receipt_id IS NOT NULL;


-- ============================================================================
-- Migration: 000023_listing_promotions.up.sql
-- ============================================================================

ALTER TABLE payment_product
  ADD COLUMN IF NOT EXISTS service_type varchar(32),
  ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE payment_product DROP CONSTRAINT IF EXISTS payment_product_vat_code_check;
ALTER TABLE payment_product ADD CONSTRAINT payment_product_vat_code_check CHECK (vat_code BETWEEN 1 AND 12);

ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS business_ref_type varchar(32),
  ADD COLUMN IF NOT EXISTS business_ref_id bigint;

INSERT INTO payment_product
  (code,title,purpose,amount_kopecks,currency,vat_code,payment_subject,payment_mode,service_type,duration_seconds)
VALUES
  ('listing_boost_7d','Продвижение объявления в поиске на 7 дней','listing_promotion',29900,'RUB',1,'service','full_payment','boost',604800),
  ('listing_highlight_7d','Выделение объявления на 7 дней','listing_promotion',14900,'RUB',1,'service','full_payment','highlight',604800)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE listing_promotion (
  id bigserial PRIMARY KEY,
  house_id integer NOT NULL REFERENCES house(id) ON DELETE CASCADE,
  purchased_by integer REFERENCES "user"(id) ON DELETE SET NULL,
  payment_id bigint UNIQUE REFERENCES payment(id) ON DELETE SET NULL,
  type varchar(32) NOT NULL CHECK (type IN ('boost','highlight')),
  status varchar(32) NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','active','paused','expired','payment_failed','cancelled')),
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  remaining_seconds integer NOT NULL CHECK (remaining_seconds >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  activated_at timestamptz,
  paused_at timestamptz,
  pause_reason varchar(64),
  checkout_key uuid NOT NULL UNIQUE,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX listing_promotion_one_open_type
  ON listing_promotion(house_id,type)
  WHERE status IN ('pending_payment','active','paused');
CREATE INDEX listing_promotion_public_lookup
  ON listing_promotion(house_id,type,expires_at DESC)
  WHERE status='active';

CREATE TABLE promotion_expiry_job (
  promotion_id bigint PRIMARY KEY REFERENCES listing_promotion(id) ON DELETE CASCADE,
  version bigint NOT NULL,
  due_at timestamptz NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','done','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error varchar(500),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX promotion_expiry_job_due
  ON promotion_expiry_job(due_at,promotion_id)
  WHERE status IN ('queued','processing');

CREATE OR REPLACE FUNCTION reconcile_listing_promotions_on_house_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rec record;
BEGIN
  IF NEW.deleted = true AND OLD.deleted = false THEN
    UPDATE listing_promotion SET status='cancelled',starts_at=NULL,expires_at=NULL,
      pause_reason='listing_deleted',version=version+1,updated_at=now()
    WHERE house_id=NEW.id AND status IN ('pending_payment','active','paused');
    RETURN NEW;
  END IF;

  IF OLD.status='active' AND NEW.status<>'active' THEN
    UPDATE listing_promotion SET status=CASE WHEN greatest(0,extract(epoch FROM (expires_at-now()))::int)=0 THEN 'expired' ELSE 'paused' END,
      remaining_seconds=greatest(0,extract(epoch FROM (expires_at-now()))::int),starts_at=NULL,expires_at=NULL,
      paused_at=now(),pause_reason='listing_not_active',version=version+1,updated_at=now()
    WHERE house_id=NEW.id AND status='active';
  ELSIF OLD.status<>'active' AND NEW.status='active' THEN
    FOR rec IN
      UPDATE listing_promotion SET status='active',starts_at=now(),expires_at=now()+make_interval(secs=>remaining_seconds),
        paused_at=NULL,pause_reason=NULL,version=version+1,updated_at=now()
      WHERE house_id=NEW.id AND status='paused' AND remaining_seconds>0
      RETURNING id,version,expires_at
    LOOP
      INSERT INTO promotion_expiry_job(promotion_id,version,due_at,status,attempts,last_error,updated_at)
      VALUES(rec.id,rec.version,rec.expires_at,'queued',0,NULL,now())
      ON CONFLICT(promotion_id) DO UPDATE SET version=EXCLUDED.version,due_at=EXCLUDED.due_at,
        status='queued',attempts=0,last_error=NULL,updated_at=now();
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS house_promotion_lifecycle ON house;
CREATE TRIGGER house_promotion_lifecycle
AFTER UPDATE OF status,deleted ON house
FOR EACH ROW EXECUTE FUNCTION reconcile_listing_promotions_on_house_change();


-- ============================================================================
-- Migration: 000024_promotion_duration_products.up.sql
-- ============================================================================

INSERT INTO payment_product
  (code,title,purpose,amount_kopecks,currency,vat_code,payment_subject,payment_mode,service_type,duration_seconds)
VALUES
  ('listing_boost_1d','Продвижение объявления в поиске на 1 день','listing_promotion',7900,'RUB',1,'service','full_payment','boost',86400),
  ('listing_boost_30d','Продвижение объявления в поиске на 30 дней','listing_promotion',89900,'RUB',1,'service','full_payment','boost',2592000),
  ('listing_highlight_1d','Выделение объявления на 1 день','listing_promotion',4900,'RUB',1,'service','full_payment','highlight',86400),
  ('listing_highlight_30d','Выделение объявления на 30 дней','listing_promotion',39900,'RUB',1,'service','full_payment','highlight',2592000)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  amount_kopecks = EXCLUDED.amount_kopecks,
  currency = EXCLUDED.currency,
  vat_code = EXCLUDED.vat_code,
  payment_subject = EXCLUDED.payment_subject,
  payment_mode = EXCLUDED.payment_mode,
  service_type = EXCLUDED.service_type,
  duration_seconds = EXCLUDED.duration_seconds,
  enabled = true,
  updated_at = now();

UPDATE payment_product
SET amount_kopecks = CASE code
  WHEN 'listing_boost_7d' THEN 29900
  WHEN 'listing_highlight_7d' THEN 14900
END,
updated_at = now()
WHERE code IN ('listing_boost_7d','listing_highlight_7d');


-- ============================================================================
-- Migration: 000025_disable_listing_publication_product.up.sql
-- ============================================================================

UPDATE payment_product
SET enabled = false,
    updated_at = now()
WHERE code = 'listing_publication';


-- ============================================================================
-- Migration: 000026_review_moderation.up.sql
-- ============================================================================

ALTER TABLE review
  ADD COLUMN IF NOT EXISTS request_id integer REFERENCES request(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_body text,
  ADD COLUMN IF NOT EXISTS published_body text,
  ADD COLUMN IF NOT EXISTS content_hash varchar(64),
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE review
SET original_body = COALESCE(original_body, body),
    published_body = CASE
      WHEN status = 'active' THEN COALESCE(published_body, body)
      ELSE published_body
    END;

CREATE UNIQUE INDEX IF NOT EXISTS review_one_per_request
  ON review(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS review_author_status_idx ON review(owner_id,status,created_at DESC);

CREATE TABLE review_reply (
  id bigserial PRIMARY KEY,
  review_id integer NOT NULL UNIQUE REFERENCES review(id) ON DELETE CASCADE,
  owner_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  original_body text NOT NULL,
  published_body text,
  status varchar(32) NOT NULL DEFAULT 'pending_moderation'
    CHECK (status IN ('pending_moderation','active','rejected','moderation_review')),
  content_hash varchar(64) NOT NULL,
  rejection_reason varchar(500),
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE review_moderation_job (
  id bigserial PRIMARY KEY,
  target_type varchar(16) NOT NULL CHECK (target_type IN ('review','reply')),
  target_id bigint NOT NULL,
  content_hash varchar(64) NOT NULL,
  detected_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  masked_body text,
  status varchar(16) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','done')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  decision varchar(32),
  category varchar(64),
  reason varchar(500),
  confidence real,
  raw_response jsonb,
  last_error varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_type,target_id,content_hash)
);
CREATE INDEX review_moderation_job_due_idx
  ON review_moderation_job(status,next_attempt_at,id);

CREATE TABLE review_summary_job (
  house_id integer PRIMARY KEY REFERENCES house(id) ON DELETE CASCADE,
  dirty_since timestamptz NOT NULL DEFAULT now(),
  run_after timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  status varchar(16) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing')),
  attempts integer NOT NULL DEFAULT 0,
  last_error varchar(1000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_summary_job_due_idx ON review_summary_job(status,run_after);


-- ============================================================================
-- Migration: 000027_review_edit_attempts.up.sql
-- ============================================================================

ALTER TABLE review ADD COLUMN edit_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE review_reply ADD COLUMN edit_attempts INT NOT NULL DEFAULT 0;


-- ============================================================================
-- Migration: 000028_listing_views.up.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS listing_view_event (
  event_id uuid PRIMARY KEY,
  house_id integer NOT NULL REFERENCES house(id) ON DELETE CASCADE,
  viewer_hash bytea NOT NULL,
  viewer_kind varchar(16) NOT NULL CHECK (viewer_kind IN ('authenticated', 'guest')),
  viewed_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_view_event_viewer_day_unique UNIQUE (house_id, viewer_hash, viewed_on)
);

CREATE INDEX IF NOT EXISTS listing_view_event_created_at_idx
  ON listing_view_event (created_at);

CREATE TABLE IF NOT EXISTS listing_view_daily (
  house_id integer NOT NULL REFERENCES house(id) ON DELETE CASCADE,
  view_date date NOT NULL,
  authenticated_views integer NOT NULL DEFAULT 0 CHECK (authenticated_views >= 0),
  guest_views integer NOT NULL DEFAULT 0 CHECK (guest_views >= 0),
  is_anomalous boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (house_id, view_date)
);

CREATE INDEX IF NOT EXISTS listing_view_daily_date_house_idx
  ON listing_view_daily (view_date, house_id)
  INCLUDE (authenticated_views, guest_views, is_anomalous);

CREATE INDEX IF NOT EXISTS house_active_created_at_idx
  ON house (created_at DESC, id DESC)
  WHERE deleted = false AND status = 'active';

CREATE INDEX IF NOT EXISTS house_active_views_idx
  ON house (views DESC, created_at DESC, id DESC)
  WHERE deleted = false AND status = 'active';


-- ============================================================================
-- Migration: 000029_add_geo_indices.up.sql
-- ============================================================================

-- Spatial index for map bounding-box queries.
-- B-tree is sufficient for simple range scans on (lat, lng).
-- Upgrade to GiST/PostGIS if bbox queries become a bottleneck.
CREATE INDEX IF NOT EXISTS idx_house_coords
  ON house (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Track geocoding quality (DaData qc_geo: 0=exact, 1=near, 2=street, 3=city, 4=region, 5=not found)
ALTER TABLE house ADD COLUMN IF NOT EXISTS qc_geo integer;


-- ============================================================================
-- Migration: 000030_user_activity_events.up.sql
-- ============================================================================

CREATE TABLE user_activity_event (
  id bigserial PRIMARY KEY,
  event_key varchar(160) NOT NULL,
  user_id integer NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  scope varchar(32) NOT NULL CHECK (scope IN ('bookings','incoming','listings','reviews')),
  event_type varchar(64) NOT NULL,
  entity_id bigint,
  action varchar(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  UNIQUE (user_id, event_key)
);

CREATE INDEX user_activity_event_unseen_idx
  ON user_activity_event (user_id, scope, created_at DESC)
  WHERE seen_at IS NULL;


-- ============================================================================
-- Migration: 000031_notification_center.up.sql
-- ============================================================================

ALTER TABLE user_activity_event
  DROP CONSTRAINT IF EXISTS user_activity_event_scope_check;

ALTER TABLE user_activity_event
  ADD CONSTRAINT user_activity_event_scope_check
  CHECK (scope IN ('messages','bookings','incoming','listings','reviews'));

CREATE INDEX user_activity_event_timeline_idx
  ON user_activity_event (user_id, created_at DESC, id DESC);


-- ============================================================================
-- Migration: 000032_repair_listing_moderation_queue.up.sql
-- ============================================================================

-- Repair rows affected by the old non-atomic moderation finalisation. If the
-- latest verdict is already done, apply it to a house that is still pending.
WITH latest_llm AS (
  SELECT DISTINCT ON (house_id)
         house_id, status, decision, reason, confidence
  FROM moderation_verdict
  WHERE source = 'llm'
  ORDER BY house_id, created_at DESC, id DESC
)
UPDATE house h
SET status = CASE
      WHEN v.decision = 'approve' THEN 'active'
      WHEN v.decision = 'reject' AND COALESCE(v.confidence, 0) >= 0.9 THEN 'rejected'
      ELSE 'moderation_review'
    END,
    rejection_reason = CASE
      WHEN v.decision = 'reject' AND COALESCE(v.confidence, 0) >= 0.9
        THEN NULLIF(left(COALESCE(v.reason, ''), 2000), '')
      ELSE NULL
    END,
    updated_at = now()
FROM latest_llm v
WHERE h.id = v.house_id
  AND h.status = 'pending_moderation'
  AND h.deleted = false
  AND v.status = 'done';

-- Retry pending jobs immediately under the fixed worker. This also recovers
-- failed/hourly-looping jobs from the previous implementation.
UPDATE moderation_verdict mv
SET status = 'queued',
    attempts = 0,
    next_attempt_at = now(),
    last_error = CASE
      WHEN mv.status = 'processing' THEN 'requeued during moderation queue repair'
      ELSE mv.last_error
    END,
    updated_at = now()
FROM house h
WHERE h.id = mv.house_id
  AND h.status = 'pending_moderation'
  AND h.deleted = false
  AND mv.source = 'llm'
  AND mv.status IN ('queued', 'processing', 'failed');


-- ============================================================================
-- Migration: 000033_expand_moderation_content_hash.up.sql
-- ============================================================================

-- ContentHash includes both the 64-character text hash and the 64-character
-- photo-list hash separated by a dot. The original varchar(64) column made
-- every new image-aware moderation enqueue fail after photo hashing was added.
ALTER TABLE moderation_verdict
  ALTER COLUMN content_hash TYPE text;

-- Pending listings created while the column was too short may have no queue
-- row at all. Seed a deliberately stale repair job. The worker will claim it,
-- notice that its hash differs from the current listing, and call Submit to
-- enqueue the real full-length hash through the normal code path.
INSERT INTO moderation_verdict
  (house_id, content_hash, source, status, next_attempt_at, last_error)
SELECT h.id,
       'repair-v33:' || h.id::text,
       'llm',
       'queued',
       now(),
       'repair pending listing that had no moderation job'
FROM house h
WHERE h.status = 'pending_moderation'
  AND h.deleted = false
  AND NOT EXISTS (
    SELECT 1
    FROM moderation_verdict mv
    WHERE mv.house_id = h.id
      AND mv.source = 'llm'
      AND mv.status IN ('queued', 'processing')
  )
ON CONFLICT DO NOTHING;

-- Existing old-format jobs are also due immediately. Their stale hash is
-- converted by the same worker path into a current full-length job.
UPDATE moderation_verdict mv
SET status = 'queued',
    next_attempt_at = now(),
    updated_at = now()
FROM house h
WHERE h.id = mv.house_id
  AND h.status = 'pending_moderation'
  AND h.deleted = false
  AND mv.source = 'llm'
  AND mv.status IN ('queued', 'processing');


-- ============================================================================
-- Migration: 000034_requeue_exhausted_listing_moderation.up.sql
-- ============================================================================

-- A clean database has no exhausted jobs. Production databases apply the
-- matching migration file to recover existing technical failures.


-- ============================================================================
-- Migration: 000035_listing_view_history.up.sql
-- ============================================================================

ALTER TABLE listing_view_event
  ADD COLUMN IF NOT EXISTS user_id integer REFERENCES "user" (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS listing_view_event_user_history_idx
  ON listing_view_event (user_id, created_at DESC, house_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS listing_view_event_user_day_unique
  ON listing_view_event (house_id, user_id, viewed_on)
  WHERE user_id IS NOT NULL;


-- Mark the consolidated migration chain as applied for golang-migrate.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version bigint NOT NULL PRIMARY KEY,
  dirty boolean NOT NULL
);
DELETE FROM schema_migrations;
INSERT INTO schema_migrations (version, dirty) VALUES (35, false);

COMMIT;
