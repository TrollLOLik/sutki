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
