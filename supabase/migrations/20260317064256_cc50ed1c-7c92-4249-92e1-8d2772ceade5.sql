
-- Fix: Remove the public policy on base products table entirely
-- Only sellers (own) and admins should access base table directly
DROP POLICY IF EXISTS "Authenticated users can view active products without game_code" ON public.products;

-- Public/anon users MUST go through products_public view
-- The existing seller and admin policies remain intact
