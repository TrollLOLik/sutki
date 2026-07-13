UPDATE payment_product
SET enabled = true,
    updated_at = now()
WHERE code = 'listing_publication';
