
-- 1. Fix orders UPDATE: create RPC and restrict policy
CREATE OR REPLACE FUNCTION public.mark_order_viewed(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE orders
  SET codes_viewed = true,
      code_viewed_at = now()
  WHERE id = _order_id
    AND user_id = auth.uid()
    AND game_code IS NOT NULL;
END;
$$;

-- Drop the broad user UPDATE policy
DROP POLICY IF EXISTS "Users can update codes_viewed on own orders" ON public.orders;

-- 2. Fix game_plays INSERT: restrict to safe defaults only
DROP POLICY IF EXISTS "Users can insert own plays" ON public.game_plays;
CREATE POLICY "Users can insert own plays" ON public.game_plays
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_paid = false AND coins_won = 0);

-- 3. Fix reviews public exposure: replace public SELECT with a view
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;

CREATE OR REPLACE VIEW public.reviews_public AS
SELECT
  id, order_id, seller_id, rating_product, rating_shipping, rating_service,
  comment, created_at, seller_response, seller_responded_at
FROM public.reviews;

-- Authenticated users can still view reviews (for buyers/sellers/admins)
CREATE POLICY "Authenticated can view reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (true);

-- 4. Fix ticket-screenshots upload: scope to ticket owners
DROP POLICY IF EXISTS "Authenticated users can upload ticket screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload ticket screenshots" ON storage.objects;

CREATE POLICY "Ticket owners can upload screenshots" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-screenshots'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );
