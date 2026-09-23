
-- Fix the security definer view warning by making it security invoker
DROP VIEW IF EXISTS public.reviews_public;
CREATE VIEW public.reviews_public
WITH (security_invoker = true)
AS
SELECT
  id, order_id, seller_id, rating_product, rating_shipping, rating_service,
  comment, created_at, seller_response, seller_responded_at
FROM public.reviews;

-- Grant public access to the view
GRANT SELECT ON public.reviews_public TO anon, authenticated;
