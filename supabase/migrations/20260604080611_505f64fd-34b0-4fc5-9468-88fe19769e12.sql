-- 1) Make orders.user_id nullable and add guest fields
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS access_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_access_token_idx ON public.orders(access_token) WHERE access_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_guest_email_idx ON public.orders(LOWER(guest_email)) WHERE guest_email IS NOT NULL;

-- 2) pending_paypal_orders supports guests too
ALTER TABLE public.pending_paypal_orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.pending_paypal_orders ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE public.pending_paypal_orders ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE public.pending_paypal_orders ADD COLUMN IF NOT EXISTS guest_session_id TEXT;
CREATE INDEX IF NOT EXISTS pending_paypal_orders_guest_session_idx ON public.pending_paypal_orders(guest_session_id) WHERE guest_session_id IS NOT NULL;

-- 3) support_tickets supports guest tickets
ALTER TABLE public.support_tickets ALTER COLUMN buyer_id DROP NOT NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

-- 4) RPC: get order by access token (for guest reveal link)
CREATE OR REPLACE FUNCTION public.get_guest_order_by_token(_order_id uuid, _token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  keys jsonb;
BEGIN
  IF _order_id IS NULL OR _token IS NULL OR length(_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT id, game_title, platform, price, quantity, status, image_url, game_code,
         codes_viewed, code_viewed_at, created_at, is_held, held_until, held_reason,
         guest_email, guest_phone, user_id, paypal_order_id,
         shipping_full_name, shipping_address_line1, shipping_address_line2,
         shipping_city, shipping_state, shipping_zip_code, shipping_country, shipping_phone,
         tracking_number, tracking_url, carrier_name, shipped_at
  INTO o
  FROM public.orders
  WHERE id = _order_id AND access_token = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Collect per-key delivery codes (for multi-quantity orders)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', pk.key_code, 'status', pk.status) ORDER BY pk.delivered_at NULLS LAST), '[]'::jsonb)
  INTO keys
  FROM public.product_keys pk
  WHERE pk.order_id = o.id;

  RETURN to_jsonb(o) || jsonb_build_object('keys', keys);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_order_by_token(uuid, text) TO anon, authenticated;

-- 5) RPC: mark guest order as viewed (used when code is revealed)
CREATE OR REPLACE FUNCTION public.mark_guest_order_viewed(_order_id uuid, _token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN RETURN false; END IF;
  UPDATE public.orders
  SET codes_viewed = true, code_viewed_at = COALESCE(code_viewed_at, now())
  WHERE id = _order_id AND access_token = _token AND game_code IS NOT NULL;
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_guest_order_viewed(uuid, text) TO anon, authenticated;

-- 6) RPC: create guest support ticket (validates order_id+email)
CREATE OR REPLACE FUNCTION public.create_guest_support_ticket(
  _order_id uuid,
  _email text,
  _issue_type text,
  _message text,
  _screenshot_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_ticket_id uuid;
BEGIN
  IF _order_id IS NULL OR _email IS NULL OR _issue_type IS NULL OR _message IS NULL THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;
  IF length(_message) < 5 OR length(_message) > 5000 THEN
    RAISE EXCEPTION 'Message length must be between 5 and 5000 characters';
  END IF;

  -- Match order by id and email (guest_email OR auth user's email)
  SELECT o.id, o.user_id, o.guest_email
  INTO v_match
  FROM public.orders o
  LEFT JOIN auth.users u ON u.id = o.user_id
  WHERE o.id = _order_id
    AND (
      LOWER(o.guest_email) = LOWER(_email)
      OR LOWER(u.email) = LOWER(_email)
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No matching order found for this email';
  END IF;

  INSERT INTO public.support_tickets (order_id, buyer_id, buyer_email, issue_type, message, screenshot_url, status, is_guest)
  VALUES (v_match.id, v_match.user_id, LOWER(_email), _issue_type, _message, _screenshot_url, 'open', v_match.user_id IS NULL)
  RETURNING id INTO v_ticket_id;

  RETURN v_ticket_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_guest_support_ticket(uuid, text, text, text, text) TO anon, authenticated;

-- 7) RLS policy for guest order INSERT via service_role (already covered by service_role bypass).
-- No public INSERT/SELECT on orders for anon — all guest reads go through the SECURITY DEFINER RPC above.
