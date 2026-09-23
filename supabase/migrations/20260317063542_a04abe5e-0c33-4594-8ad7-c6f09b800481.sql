
-- Fix: Make the view SECURITY INVOKER (default, but explicit) to use querying user's RLS
CREATE OR REPLACE VIEW public.seller_ticket_view WITH (security_invoker = true) AS
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
