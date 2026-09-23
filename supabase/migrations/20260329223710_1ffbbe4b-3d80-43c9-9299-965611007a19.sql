CREATE OR REPLACE FUNCTION public.increment_sold_count(_product_id uuid, _qty integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.allowed_products
  SET sold_count = sold_count + _qty
  WHERE id = _product_id
$$;