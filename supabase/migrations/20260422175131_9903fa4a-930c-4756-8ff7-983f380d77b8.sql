UPDATE allowed_products
SET title = 'PRE-ORDER BONUS: ' || regexp_replace(title, '^[\s:_\-–—]+', '', 'g')
WHERE description ILIKE '%pre-order bonus%'
  AND title NOT ILIKE 'PRE-ORDER BONUS%';