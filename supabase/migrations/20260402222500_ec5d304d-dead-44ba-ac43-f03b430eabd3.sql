-- Drop the current permissive policy
DROP POLICY IF EXISTS "Anyone can subscribe for stock notifications" ON public.stock_notifications;

-- Create restricted insert policy
CREATE POLICY "Anyone can subscribe for stock notifications"
ON public.stock_notifications
FOR INSERT
TO public
WITH CHECK (
  email IS NOT NULL AND email <> '' AND
  allowed_product_id IS NOT NULL AND
  notified = false
);