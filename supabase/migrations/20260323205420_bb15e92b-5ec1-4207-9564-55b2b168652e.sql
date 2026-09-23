INSERT INTO collection_products (collection_id, allowed_product_id)
SELECT '31f1eba2-d9c7-4a59-b847-815c630be06c', id
FROM allowed_products
WHERE store = 'In-Game Items' AND LOWER(title) LIKE '%fortnite%'
AND id NOT IN (SELECT allowed_product_id FROM collection_products WHERE collection_id = '31f1eba2-d9c7-4a59-b847-815c630be06c')