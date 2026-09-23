CREATE POLICY "Public can view active kinguin products"
ON public.kinguin_products
FOR SELECT
TO public
USING (is_active = true AND kinguin_stock > 0);