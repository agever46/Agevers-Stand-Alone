
-- Fix 1: Add role check to WITH CHECK on seller payment accounts update
DROP POLICY IF EXISTS "Sellers can update own payment accounts" ON public.seller_payment_accounts;
CREATE POLICY "Sellers can update own payment accounts"
ON public.seller_payment_accounts
FOR UPDATE
USING ((seller_id = auth.uid()) AND has_role(auth.uid(), 'seller'::app_role))
WITH CHECK ((seller_id = auth.uid()) AND has_role(auth.uid(), 'seller'::app_role));

-- Fix 2: Replace fuzzy LIKE match on ticket screenshot storage policy with strict path/id join
DROP POLICY IF EXISTS "Ticket participants can view screenshots" ON storage.objects;
CREATE POLICY "Ticket participants can view screenshots"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'ticket-screenshots'
  AND (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE (st.id)::text = (storage.foldername(objects.name))[1]
        AND (st.buyer_id = auth.uid() OR st.seller_id = auth.uid())
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
