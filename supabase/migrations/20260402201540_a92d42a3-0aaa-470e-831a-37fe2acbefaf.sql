
DROP POLICY "Service role can insert suggestions" ON public.kinguin_product_suggestions;

CREATE POLICY "Admins can insert suggestions"
ON public.kinguin_product_suggestions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
