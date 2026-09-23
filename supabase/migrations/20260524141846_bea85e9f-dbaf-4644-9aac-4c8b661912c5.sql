DROP FUNCTION IF EXISTS public.get_public_product_variations(uuid);
DROP FUNCTION IF EXISTS public.get_public_variation_stock(uuid[]);

CREATE FUNCTION public.get_public_product_variations(_allowed_product_id uuid)
RETURNS TABLE(
  id uuid,
  allowed_product_id uuid,
  sku_id text,
  variation_name text,
  image_url text,
  stock integer,
  sku_attr text,
  price numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pv.id, pv.allowed_product_id, pv.sku_id, pv.variation_name, pv.image_url, pv.stock, pv.sku_attr,
         CASE WHEN pv.price IS NULL THEN NULL ELSE ROUND((pv.price * 2)::numeric, 2) END AS price
  FROM public.product_variations pv
  WHERE pv.allowed_product_id = _allowed_product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_product_variations(uuid) TO anon, authenticated;

CREATE FUNCTION public.get_public_variation_stock(_allowed_product_ids uuid[])
RETURNS TABLE(allowed_product_id uuid, stock integer, price numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pv.allowed_product_id, pv.stock,
         CASE WHEN pv.price IS NULL THEN NULL ELSE ROUND((pv.price * 2)::numeric, 2) END AS price
  FROM public.product_variations pv
  WHERE pv.allowed_product_id = ANY(_allowed_product_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_variation_stock(uuid[]) TO anon, authenticated;