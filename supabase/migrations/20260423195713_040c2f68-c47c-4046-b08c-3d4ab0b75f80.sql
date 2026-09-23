-- Reclassify "Skin/Skins Pack", "Pattern Pack", and "Anniversary ... Skins Pack" products as DLC.
-- These are downloadable cosmetic packs, not full editions/skins of base game.

UPDATE allowed_products
SET product_type = 'DLC'
WHERE product_type IN ('Edition', 'Skin', 'Game', 'Bundle')
  AND COALESCE(original_title, title) ~* '(skins?\s+pack|pattern\s+pack|skin\s+bundle|skins?\s+collection|faceplates?\s+collection|commanders?\s+collection)'
  AND COALESCE(original_title, title) !~* '\m(base\s+game|full\s+game|standard\s+edition)\M';

-- Also: Anniversary "Skins Pack" or "Exclusive Skins Pack" -> DLC even if "Anniversary" triggered Edition
UPDATE allowed_products
SET product_type = 'DLC'
WHERE product_type = 'Edition'
  AND COALESCE(original_title, title) ~* 'anniversary[^,]*\s+(exclusive\s+)?skins?\s+pack';
