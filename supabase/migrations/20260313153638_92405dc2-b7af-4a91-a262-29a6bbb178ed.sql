UPDATE allowed_products 
SET store = 'Steam' 
WHERE store = 'EA Games' 
AND title NOT ILIKE '%EA APP%' 
AND title NOT ILIKE '%EA PLAY%' 
AND title NOT ILIKE '%EA SPORTS%';