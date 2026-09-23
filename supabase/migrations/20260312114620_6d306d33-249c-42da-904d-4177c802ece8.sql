UPDATE allowed_products SET store = 'Steam' WHERE store = 'Kinguin';
UPDATE allowed_products SET title = REGEXP_REPLACE(title, '\s*\(?[Kk]inguin\)?\s*', ' ', 'g') WHERE title ILIKE '%kinguin%';
UPDATE allowed_products SET title = TRIM(title);