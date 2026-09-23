-- 1. Add allowed_product_id to reviews
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS allowed_product_id uuid REFERENCES public.allowed_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_allowed_product_id ON public.reviews(allowed_product_id);

-- 2. Backfill from orders by matching game_title -> allowed_products.title
UPDATE public.reviews r
SET allowed_product_id = ap.id
FROM public.orders o
JOIN public.allowed_products ap ON LOWER(TRIM(ap.title)) = LOWER(TRIM(o.game_title))
WHERE r.order_id = o.id
  AND r.allowed_product_id IS NULL;

-- 3. Public view: anonymized reviews per product
CREATE OR REPLACE VIEW public.product_reviews_public
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.allowed_product_id,
  r.rating_product,
  r.rating_shipping,
  r.rating_service,
  r.comment,
  r.created_at,
  r.seller_response,
  r.seller_responded_at,
  COALESCE(p.username, 'Verified Buyer') AS reviewer_name
FROM public.reviews r
LEFT JOIN public.profiles p ON p.user_id = r.buyer_id
WHERE r.allowed_product_id IS NOT NULL
  AND r.comment IS NOT NULL
  AND LENGTH(TRIM(r.comment)) > 0;

GRANT SELECT ON public.product_reviews_public TO anon, authenticated;

-- 4. Aggregate stats function
CREATE OR REPLACE FUNCTION public.get_product_rating_stats(_product_id uuid)
RETURNS TABLE(avg_rating numeric, review_count bigint, rating_5 bigint, rating_4 bigint, rating_3 bigint, rating_2 bigint, rating_1 bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROUND(AVG(rating_product)::numeric, 2) AS avg_rating,
    COUNT(*)::bigint AS review_count,
    COUNT(*) FILTER (WHERE rating_product = 5)::bigint AS rating_5,
    COUNT(*) FILTER (WHERE rating_product = 4)::bigint AS rating_4,
    COUNT(*) FILTER (WHERE rating_product = 3)::bigint AS rating_3,
    COUNT(*) FILTER (WHERE rating_product = 2)::bigint AS rating_2,
    COUNT(*) FILTER (WHERE rating_product = 1)::bigint AS rating_1
  FROM public.reviews
  WHERE allowed_product_id = _product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_rating_stats(uuid) TO anon, authenticated;