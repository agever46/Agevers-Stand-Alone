DROP POLICY IF EXISTS "Sellers can update their own keys" ON public.product_keys;
CREATE POLICY "Sellers can update their own keys"
ON public.product_keys
FOR UPDATE
TO authenticated
USING (seller_id = auth.uid() AND has_role(auth.uid(), 'seller'::app_role))
WITH CHECK (seller_id = auth.uid() AND has_role(auth.uid(), 'seller'::app_role));