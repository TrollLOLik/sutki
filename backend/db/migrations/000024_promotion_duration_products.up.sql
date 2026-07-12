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
