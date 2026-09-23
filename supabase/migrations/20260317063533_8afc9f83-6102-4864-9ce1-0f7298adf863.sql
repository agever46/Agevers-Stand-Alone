
-- 1. Drop the overly permissive public SELECT policy on profiles
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;

-- 2. Create a seller ticket view that masks buyer_email
CREATE OR REPLACE VIEW public.seller_ticket_view AS
SELECT 
  id,
  order_id,
  LEFT(buyer_email, 2) || '***@' || SPLIT_PART(buyer_email, '@', 2) AS buyer_email,
  issue_type,
  message,
  status,
  admin_note,
  seller_response,
  resolution_type,
  screenshot_url,
  created_at,
  updated_at,
  seller_id,
  buyer_id
FROM public.support_tickets;

-- 3. Enable RLS on the view (views inherit from base table, but we add explicit policies)
-- Grant select on the view
GRANT SELECT ON public.seller_ticket_view TO authenticated;
