
-- Drop the problematic view, use a SECURITY DEFINER function instead
DROP VIEW IF EXISTS public.kinguin_products_public;

-- Create a safe function to get public kinguin product data
CREATE OR REPLACE FUNCTION public.get_public_kinguin_products()
RETURNS TABLE(id uuid, allowed_product_id uuid, sell_price numeric, kinguin_stock integer, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kp.id, kp.allowed_product_id, kp.sell_price, kp.kinguin_stock, kp.is_active
  FROM kinguin_products kp
  WHERE kp.is_active = true;
$$;

-- Also create a filtered version for specific allowed_product_ids
CREATE OR REPLACE FUNCTION public.get_public_kinguin_by_ids(_ids uuid[])
RETURNS TABLE(id uuid, allowed_product_id uuid, sell_price numeric, kinguin_stock integer, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kp.id, kp.allowed_product_id, kp.sell_price, kp.kinguin_stock, kp.is_active
  FROM kinguin_products kp
  WHERE kp.is_active = true AND kp.allowed_product_id = ANY(_ids);
$$;

-- Create a version for single product lookup
CREATE OR REPLACE FUNCTION public.get_public_kinguin_single(_allowed_product_id uuid)
RETURNS TABLE(id uuid, allowed_product_id uuid, sell_price numeric, kinguin_stock integer, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kp.id, kp.allowed_product_id, kp.sell_price, kp.kinguin_stock, kp.is_active
  FROM kinguin_products kp
  WHERE kp.is_active = true AND kp.allowed_product_id = _allowed_product_id
  LIMIT 1;
$$;
