DELETE FROM payment_product
WHERE code IN (
  'listing_boost_1d',
  'listing_boost_30d',
  'listing_highlight_1d',
  'listing_highlight_30d'
);
