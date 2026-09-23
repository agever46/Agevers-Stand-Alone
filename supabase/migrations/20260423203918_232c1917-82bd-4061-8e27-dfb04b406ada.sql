-- Fix specific products user flagged
-- 1) Baldur's Gate 3 - Digital Deluxe Edition Upgrade → Upgrade (was DLC)
UPDATE allowed_products
SET product_type = 'Upgrade'
WHERE id = '192d8761-bc7b-4946-9520-56ff7cd8c5e7';

-- 2) Divinity: Original Sin Enhanced Edition + Source Hunter DLC → Game + Bonus
UPDATE allowed_products
SET product_type = 'Game + Bonus'
WHERE id = '051e5782-a3ea-49a1-817a-1ddd434823ab';

-- 3) Bulk reclassify all other "Edition Upgrade" / "Upgrade Pack" products
-- currently misclassified as DLC. These are upgrades for existing owners.
UPDATE allowed_products
SET product_type = 'Upgrade'
WHERE product_type = 'DLC'
  AND (
    title ~* '\m(edition\s+upgrade|upgrade\s+pack|upgrade\s+edition|upgrade\s+dlc)\M'
    OR original_title ~* '\m(edition\s+upgrade|upgrade\s+pack|upgrade\s+edition|upgrade\s+dlc)\M'
  );