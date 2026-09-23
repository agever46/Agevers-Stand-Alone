UPDATE allowed_products 
SET store = 'Subscriptions' 
WHERE platform = 'Xbox' 
AND (title ILIKE '%game pass%' OR title ILIKE '%subscription%')
AND store = 'Xbox Live';