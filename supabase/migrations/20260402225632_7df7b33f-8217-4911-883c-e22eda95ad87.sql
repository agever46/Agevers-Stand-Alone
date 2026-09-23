-- Fix 1: stock_notifications - restrict SELECT to admins and owners
CREATE POLICY "Admins can view all stock notifications"
ON public.stock_notifications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own stock notifications"
ON public.stock_notifications
FOR SELECT
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Fix 2: product-images - restrict seller DELETE to own folder
DROP POLICY IF EXISTS "Sellers can delete their product images" ON storage.objects;

CREATE POLICY "Sellers can delete their own product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND has_role(auth.uid(), 'seller'::app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Fix 3: ticket-screenshots - remove loose INSERT policy
DROP POLICY IF EXISTS "Ticket owners can upload screenshots" ON storage.objects;

-- Fix 4: order_refunds - let buyers see their own refunds
CREATE POLICY "Users can view refunds on their own orders"
ON public.order_refunds
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_refunds.order_id
    AND o.user_id = auth.uid()
  )
);