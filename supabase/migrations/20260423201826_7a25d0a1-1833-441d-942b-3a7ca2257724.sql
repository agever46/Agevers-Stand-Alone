UPDATE allowed_products
SET title = regexp_replace(title, '\(\s*(\d+)\)\s*$', '(Variant \1)', 'g')
WHERE product_type = 'Pre-Order'
  AND title ~ '\(\s*\d+\)\s*$';