-- Mark products as PRE-ORDER BONUS based on their description content
UPDATE allowed_products
SET title = 'PRE-ORDER BONUS: ' || regexp_replace(title, '^(:\s*DLC:\s*|DLC:\s*)', '', 'i')
WHERE (description ILIKE '%pre-order bonus dlc%' OR description ILIKE '%pre order bonus dlc%' OR description ILIKE '%this pre-order bonus%')
  AND title NOT ILIKE '%PRE-ORDER BONUS%';