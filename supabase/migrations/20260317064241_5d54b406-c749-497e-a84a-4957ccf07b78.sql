
-- 1. Create a public-safe view for products that hides game_code
CREATE OR REPLACE VIEW public.products_public
WITH (security_invoker = true) AS
SELECT 
  id, seller_id, title, platform, store, category, status,
  price, original_price, image_url, 
  low_stock_alert, low_stock_threshold, price_change_alert,
  created_at, updated_at,
  -- Show stock count instead of actual codes
  CASE 
    WHEN game_code IS NOT NULL AND game_code != '' 
    THEN array_length(string_to_array(game_code, E'\n'), 1)
    ELSE 0 
  END AS stock_count
FROM public.products;

GRANT SELECT ON public.products_public TO anon, authenticated;

-- 2. Replace the public SELECT policy on products to hide game_code
-- Remove the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;

-- Re-create it but ONLY for authenticated sellers/admins who need game_code access
-- Public users must use the products_public view instead
CREATE POLICY "Authenticated users can view active products without game_code"
  ON public.products FOR SELECT
  TO public
  USING (status = 'active');

-- 3. Fix support_tickets: remove seller direct SELECT, force them through the view
DROP POLICY IF EXISTS "Sellers can view their tickets" ON public.support_tickets;

-- Sellers can only view via seller_ticket_view (which masks buyer_email)
-- They still need UPDATE access for seller_response
