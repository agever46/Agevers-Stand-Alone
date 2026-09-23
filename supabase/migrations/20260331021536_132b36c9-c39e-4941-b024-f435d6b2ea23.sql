UPDATE allowed_products 
SET platform = 'Gift Cards', store = 'Gift Cards'
WHERE title ILIKE '%burger king%' AND platform = 'In-Game Items';