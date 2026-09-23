
ALTER TABLE public.reviews 
  ADD COLUMN seller_response text DEFAULT NULL,
  ADD COLUMN seller_responded_at timestamp with time zone DEFAULT NULL;

-- Allow sellers to update only their own reviews (to add responses)
CREATE POLICY "Sellers can respond to their reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);
