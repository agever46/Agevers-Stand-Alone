UPDATE public.kinguin_product_suggestions
SET category = 'pre_order'
WHERE status = 'pending'
  AND category <> 'pre_order'
  AND release_date IS NOT NULL
  AND release_date ~ '^\d{4}-\d{2}-\d{2}'
  AND (release_date::timestamptz) > now();