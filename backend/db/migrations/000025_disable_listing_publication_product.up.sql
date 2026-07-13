UPDATE payment_product
SET enabled = false,
    updated_at = now()
WHERE code = 'listing_publication';
