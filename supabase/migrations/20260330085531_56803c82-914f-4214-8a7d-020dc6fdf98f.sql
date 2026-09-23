
DELETE FROM collection_products
WHERE allowed_product_id IN (
  SELECT id FROM allowed_products
  WHERE store = 'In-Game Items' AND tab_category = 'in-game-items' AND title ILIKE '%call of duty%'
);

DELETE FROM kinguin_products
WHERE allowed_product_id IN (
  SELECT id FROM allowed_products
  WHERE store = 'In-Game Items' AND tab_category = 'in-game-items' AND title ILIKE '%call of duty%'
);

DELETE FROM allowed_products
WHERE store = 'In-Game Items' AND tab_category = 'in-game-items' AND title ILIKE '%call of duty%';
