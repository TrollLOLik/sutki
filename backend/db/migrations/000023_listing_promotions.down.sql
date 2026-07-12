DROP TRIGGER IF EXISTS house_promotion_lifecycle ON house;
DROP FUNCTION IF EXISTS reconcile_listing_promotions_on_house_change();
DROP TABLE IF EXISTS promotion_expiry_job;
DROP TABLE IF EXISTS listing_promotion;
DELETE FROM payment_product WHERE code IN ('listing_boost_7d','listing_highlight_7d');
ALTER TABLE payment DROP COLUMN IF EXISTS business_ref_id, DROP COLUMN IF EXISTS business_ref_type;
ALTER TABLE payment_product DROP COLUMN IF EXISTS duration_seconds, DROP COLUMN IF EXISTS service_type;
