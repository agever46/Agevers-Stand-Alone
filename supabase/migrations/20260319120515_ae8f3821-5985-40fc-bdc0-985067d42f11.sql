CREATE OR REPLACE FUNCTION public.get_manual_key_counts()
RETURNS TABLE(allowed_product_id uuid, key_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT allowed_product_id, COUNT(*) as key_count
  FROM public.product_keys
  WHERE status = 'active' AND allowed_product_id IS NOT NULL
  GROUP BY allowed_product_id
$$;