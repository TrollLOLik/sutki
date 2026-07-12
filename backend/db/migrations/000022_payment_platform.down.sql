DROP TABLE IF EXISTS payment_receipt;
DROP TABLE IF EXISTS payment_refund;
DROP TABLE IF EXISTS payment_webhook_event;
DROP TABLE IF EXISTS payment_product;
DROP INDEX IF EXISTS idx_payment_user_created;
DROP INDEX IF EXISTS uniq_payment_idempotency_key;
ALTER TABLE payment
  DROP COLUMN IF EXISTS refunded_amount_kopecks,
  DROP COLUMN IF EXISTS canceled_at,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS product_code,
  DROP COLUMN IF EXISTS purpose;
