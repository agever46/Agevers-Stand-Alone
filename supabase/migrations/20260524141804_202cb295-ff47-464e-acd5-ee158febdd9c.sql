-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view variations" ON public.product_variations;

-- Public RPC that returns variation data without exposing the internal cost price
CREATE OR REPLACE FUNCTION public.get_public_product_variations(_allowed_product_id uuid)
RETURNS TABLE(
  id uuid,
  allowed_product_id uuid,
  sku_id text,
  variation_name text,
  image_url text,
  stock integer,
  sku_attr text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pv.id, pv.allowed_product_id, pv.sku_id, pv.variation_name, pv.image_url, pv.stock, pv.sku_attr
  FROM public.product_variations pv
  WHERE pv.allowed_product_id = _allowed_product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_product_variations(uuid) TO anon, authenticated;

-- Stock-only aggregate for store/collection pages (no price exposure)
CREATE OR REPLACE FUNCTION public.get_public_variation_stock(_allowed_product_ids uuid[])
RETURNS TABLE(allowed_product_id uuid, stock integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pv.allowed_product_id, pv.stock
  FROM public.product_variations pv
  WHERE pv.allowed_product_id = ANY(_allowed_product_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_variation_stock(uuid[]) TO anon, authenticated;