UPDATE allowed_products
SET title = 'PRE-ORDER BONUS: ' || regexp_replace(title, '^[\s:]+', '', 'g')
WHERE (description ILIKE '%pre-order bonus%' OR description ILIKE '%pre order bonus%')
  AND title NOT ILIKE '%PRE-ORDER BONUS%';