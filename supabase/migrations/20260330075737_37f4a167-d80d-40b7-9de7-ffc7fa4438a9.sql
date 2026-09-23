
-- Fix security definer view by recreating with security_invoker
DROP VIEW IF EXISTS public.kinguin_products_public;
CREATE VIEW public.kinguin_products_public
WITH (security_invoker = true)
AS SELECT id, allowed_product_id, sell_price, kinguin_stock, is_active
FROM public.kinguin_products
WHERE is_active = true;

GRANT SELECT ON public.kinguin_products_public TO anon, authenticated;
