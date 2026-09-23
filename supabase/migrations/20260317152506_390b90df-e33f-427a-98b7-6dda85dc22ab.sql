CREATE POLICY "Sellers can update seller_seen on own withdrawals"
ON public.withdrawal_requests
FOR UPDATE
TO authenticated
USING (seller_id = auth.uid() AND has_role(auth.uid(), 'seller'::app_role))
WITH CHECK (seller_id = auth.uid() AND has_role(auth.uid(), 'seller'::app_role));