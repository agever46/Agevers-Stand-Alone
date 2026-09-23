UPDATE allowed_products
SET title = 'PRE-ORDER BONUS: ' || regexp_replace(title, '^[\s:_\-–—]+', '', 'g')
WHERE (description ILIKE '%pre-order bonus%' OR description ILIKE '%pre order bonus%' OR description ILIKE '%preorder bonus%')
  AND title NOT ILIKE 'PRE-ORDER BONUS:%';