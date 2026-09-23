
-- Restrict reviews SELECT to only buyer, seller, and admins
DROP POLICY IF EXISTS "Authenticated can view reviews" ON public.reviews;

CREATE POLICY "Users can view relevant reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
    OR has_role(auth.uid(), 'admin'::app_role)
  );
