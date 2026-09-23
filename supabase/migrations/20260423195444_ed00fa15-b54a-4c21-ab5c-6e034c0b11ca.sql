-- Fix product_type for products mistakenly classified as "Edition" when title clearly says DLC/Season Pass/Expansion
UPDATE allowed_products
SET product_type = 'DLC'
WHERE product_type = 'Edition'
  AND COALESCE(original_title, title) ~* '\mDLC\M';

UPDATE allowed_products
SET product_type = 'Season Pass'
WHERE product_type = 'Edition'
  AND COALESCE(original_title, title) ~* '\mSeason Pass\M';

UPDATE allowed_products
SET product_type = 'Expansion'
WHERE product_type = 'Edition'
  AND COALESCE(original_title, title) ~* '\mExpansion\M'
  AND COALESCE(original_title, title) !~* '\mDLC\M';