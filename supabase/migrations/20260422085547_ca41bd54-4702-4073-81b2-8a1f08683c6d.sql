UPDATE public.kinguin_product_suggestions
SET platform = 'Gift Cards', store = 'Gift Cards'
WHERE status = 'pending'
  AND title ILIKE '%gift card%'
  AND (platform IS DISTINCT FROM 'Gift Cards' OR store IS DISTINCT FROM 'Gift Cards');