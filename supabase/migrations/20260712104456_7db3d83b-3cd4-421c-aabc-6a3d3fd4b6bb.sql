
DROP FUNCTION IF EXISTS public.get_guest_orders_by_paypal(text, text);
DROP FUNCTION IF EXISTS public.reveal_guest_order_codes(text, text, text);
DROP FUNCTION IF EXISTS public.get_guest_order_by_token(uuid, text);
DROP FUNCTION IF EXISTS public.mark_guest_order_viewed(uuid, text);
DROP FUNCTION IF EXISTS public.create_guest_support_ticket(uuid, text, text, text, text);
