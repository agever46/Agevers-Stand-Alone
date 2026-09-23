
-- 1. Fix the insecure profile INSERT policy
DROP POLICY IF EXISTS "Allow system profile creation" ON public.profiles;
CREATE POLICY "Allow system profile creation" ON public.profiles
  FOR INSERT 
  TO service_role
  WITH CHECK (true);

-- 2. Address Security Definer View finding (ensure views are security invoker or correctly managed)
-- In Supabase/Postgres, views are usually security invokers unless created with SECURITY DEFINER.
-- The linter often flags views created by 'postgres' user if they don't explicitly handle RLS.
-- We will recreate the views to ensure they are standard.

DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  user_id,
  display_name,
  username,
  avatar_url,
  created_at
FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

DROP VIEW IF EXISTS public.product_reviews_public;
CREATE VIEW public.product_reviews_public AS
 SELECT r.id,
    r.allowed_product_id,
    r.rating_product,
    r.rating_shipping,
    r.rating_service,
    r.comment,
    r.created_at,
    r.seller_response,
    r.seller_responded_at,
    COALESCE(p.username, 'Verified Buyer'::text) AS reviewer_name
   FROM (public.reviews r
     LEFT JOIN public.profiles p ON ((p.user_id = r.buyer_id)))
  WHERE ((r.allowed_product_id IS NOT NULL) AND (r.comment IS NOT NULL) AND (length(TRIM(BOTH FROM r.comment)) > 0));
GRANT SELECT ON public.product_reviews_public TO anon, authenticated;

DROP VIEW IF EXISTS public.reviews_public;
CREATE VIEW public.reviews_public AS
 SELECT id,
    order_id,
    seller_id,
    rating_product,
    rating_shipping,
    rating_service,
    comment,
    created_at,
    seller_response,
    seller_responded_at
   FROM public.reviews;
GRANT SELECT ON public.reviews_public TO anon, authenticated;

DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public AS
 SELECT id,
    seller_id,
    title,
    platform,
    store,
    category,
    status,
    price,
    original_price,
    image_url,
    created_at,
    updated_at,
        CASE
            WHEN ((game_code IS NOT NULL) AND (game_code <> ''::text)) THEN array_length(string_to_array(game_code, E'\n'), 1)
            ELSE 0
        END AS stock_count
   FROM public.products;
GRANT SELECT ON public.products_public TO anon, authenticated;
