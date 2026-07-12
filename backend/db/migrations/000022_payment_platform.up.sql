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
