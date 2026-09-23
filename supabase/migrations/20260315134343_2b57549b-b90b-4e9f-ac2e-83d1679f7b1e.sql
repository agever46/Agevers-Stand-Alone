
CREATE OR REPLACE FUNCTION public.get_seller_for_order(_order_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT seller_id FROM public.product_keys 
  WHERE order_id = _order_id 
  LIMIT 1
$$;
