CREATE POLICY "Admins can view all pending paypal orders"
  ON public.pending_paypal_orders
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));