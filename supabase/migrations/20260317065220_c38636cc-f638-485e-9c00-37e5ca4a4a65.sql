
-- Drop and recreate views with corrected columns
DROP VIEW IF EXISTS public.seller_ticket_view;
DROP VIEW IF EXISTS public.products_public;

-- 1. seller_ticket_view: security definer, masks email, hides admin_note, filters by seller
CREATE VIEW public.seller_ticket_view AS
SELECT 
  id,
  order_id,
  LEFT(buyer_email, 2) || '***@' || SPLIT_PART(buyer_email, '@', 2) AS buyer_email,
  issue_type,
  message,
  status,
  seller_response,
  resolution_type,
  screenshot_url,
  created_at,
  updated_at,
  seller_id,
  buyer_id
FROM public.support_tickets
WHERE seller_id = auth.uid();

-- 2. products_public: security definer, only public-safe columns, active filter built-in
CREATE VIEW public.products_public AS
SELECT 
  id, seller_id, title, platform, store, category, status,
  price, original_price, image_url,
  created_at, updated_at,
  CASE 
    WHEN game_code IS NOT NULL AND game_code != '' 
    THEN array_length(string_to_array(game_code, E'\n'), 1)
    ELSE 0 
  END AS stock_count
FROM public.products
WHERE status = 'active';

GRANT SELECT ON public.seller_ticket_view TO authenticated;
GRANT SELECT ON public.products_public TO anon, authenticated;
