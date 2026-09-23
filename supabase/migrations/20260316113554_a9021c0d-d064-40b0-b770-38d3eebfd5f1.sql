
-- Create reviews table
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  rating_product integer NOT NULL,
  rating_shipping integer NOT NULL,
  rating_service integer NOT NULL,
  comment text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reviews_order_unique UNIQUE (order_id),
  CONSTRAINT reviews_rating_product_check CHECK (rating_product >= 1 AND rating_product <= 5),
  CONSTRAINT reviews_rating_shipping_check CHECK (rating_shipping >= 1 AND rating_shipping <= 5),
  CONSTRAINT reviews_rating_service_check CHECK (rating_service >= 1 AND rating_service <= 5),
  CONSTRAINT reviews_comment_not_empty CHECK (length(trim(comment)) > 0)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY "Anyone can view reviews" ON public.reviews
FOR SELECT TO public USING (true);

-- Only buyer can insert, and only for completed orders
CREATE POLICY "Buyers can insert review for completed orders" ON public.reviews
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = buyer_id
  AND EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_id
    AND orders.user_id = auth.uid()
    AND orders.status = 'completed'
  )
);

-- Admins can manage all reviews
CREATE POLICY "Admins can manage reviews" ON public.reviews
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Create function to get seller average ratings
CREATE OR REPLACE FUNCTION public.get_seller_avg_ratings(_seller_id uuid)
RETURNS TABLE(avg_product numeric, avg_shipping numeric, avg_service numeric, avg_overall numeric, review_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ROUND(AVG(rating_product)::numeric, 2) as avg_product,
    ROUND(AVG(rating_shipping)::numeric, 2) as avg_shipping,
    ROUND(AVG(rating_service)::numeric, 2) as avg_service,
    ROUND(((AVG(rating_product) + AVG(rating_shipping) + AVG(rating_service)) / 3)::numeric, 2) as avg_overall,
    COUNT(*) as review_count
  FROM public.reviews
  WHERE seller_id = _seller_id
$$;
