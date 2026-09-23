
-- Replace seller_ticket_view with a security definer function
DROP VIEW IF EXISTS public.seller_ticket_view;

-- Create function that returns seller's tickets with masked email
CREATE OR REPLACE FUNCTION public.get_seller_tickets()
RETURNS TABLE(
  id uuid,
  order_id uuid,
  buyer_email text,
  issue_type text,
  message text,
  status text,
  seller_response text,
  resolution_type text,
  screenshot_url text,
  created_at timestamptz,
  updated_at timestamptz,
  seller_id uuid,
  buyer_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id,
    t.order_id,
    LEFT(t.buyer_email, 2) || '***@' || SPLIT_PART(t.buyer_email, '@', 2),
    t.issue_type,
    t.message,
    t.status,
    t.seller_response,
    t.resolution_type,
    t.screenshot_url,
    t.created_at,
    t.updated_at,
    t.seller_id,
    t.buyer_id
  FROM public.support_tickets t
  WHERE t.seller_id = auth.uid()
$$;

-- Replace products_public with security invoker + add back public SELECT policy
DROP VIEW IF EXISTS public.products_public;

-- Re-add public SELECT policy on products but ONLY for safe columns approach
-- Since RLS can't filter columns, we use the view approach
-- Add back a limited public policy so security_invoker view works
CREATE POLICY "Public can view active products"
  ON public.products FOR SELECT
  TO public
  USING (status = 'active');

-- Recreate products_public as security invoker (safe since base table allows public SELECT)
CREATE VIEW public.products_public
WITH (security_invoker = true) AS
SELECT 
  id, seller_id, title, platform, store, category, status,
  price, original_price, image_url,
  created_at, updated_at,
  CASE 
    WHEN game_code IS NOT NULL AND game_code != '' 
    THEN array_length(string_to_array(game_code, E'\n'), 1)
    ELSE 0 
  END AS stock_count
FROM public.products;

GRANT SELECT ON public.products_public TO anon, authenticated;
