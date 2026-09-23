ALTER TABLE public.orders ADD COLUMN codes_viewed boolean NOT NULL DEFAULT false;

CREATE POLICY "Users can update codes_viewed on own orders"
ON public.orders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);