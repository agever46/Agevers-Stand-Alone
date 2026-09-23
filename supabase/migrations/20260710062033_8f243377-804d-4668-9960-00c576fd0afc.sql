
-- 1) Column-filtered Realtime publication for orders: exclude game_code + access_token
--    (skip generated column code_delivered — publications cannot include it)
ALTER PUBLICATION supabase_realtime SET TABLE public.orders (
  id, user_id, game_title, platform, price, status, created_at, paypal_order_id,
  quantity, image_url, codes_viewed, ip_address, user_agent, buyer_country, buyer_city,
  code_viewed_at, is_held, held_until, held_reason, approved_by, approved_at,
  shipping_full_name, shipping_address_line1, shipping_address_line2, shipping_city,
  shipping_state, shipping_zip_code, shipping_country, shipping_phone,
  tracking_number, tracking_url, carrier_name, shipped_at, aliexpress_order_id,
  pending_kinguin, guest_email, guest_phone, paypal_payer_snapshot
);

-- 2) Guest order lookup: strip game_code from the payload
CREATE OR REPLACE FUNCTION public.get_guest_orders_by_paypal(_paypal_order_id text, _token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_token text;
  v_orders jsonb;
BEGIN
  IF _paypal_order_id IS NULL OR _token IS NULL OR length(_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT access_token INTO v_first_token
  FROM public.orders
  WHERE paypal_order_id = _paypal_order_id
    AND access_token = _token
  LIMIT 1;

  IF v_first_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'game_title', o.game_title,
    'platform', o.platform,
    'price', o.price,
    'quantity', o.quantity,
    'status', o.status,
    'image_url', o.image_url,
    -- game_code intentionally omitted — use reveal_guest_order_codes
    'codes_viewed', o.codes_viewed,
    'created_at', o.created_at,
    'is_held', o.is_held,
    'held_until', o.held_until,
    'held_reason', o.held_reason,
    'pending_kinguin', o.pending_kinguin,
    'paypal_order_id', o.paypal_order_id,
    'guest_email', o.guest_email,
    'user_id', o.user_id,
    'access_token', o.access_token,
    'shipping_full_name', o.shipping_full_name,
    'shipping_address_line1', o.shipping_address_line1,
    'shipping_city', o.shipping_city,
    'shipping_country', o.shipping_country,
    'tracking_number', o.tracking_number,
    'tracking_url', o.tracking_url,
    'carrier_name', o.carrier_name
  ) ORDER BY o.created_at), '[]'::jsonb)
  INTO v_orders
  FROM public.orders o
  WHERE o.paypal_order_id = _paypal_order_id
    AND o.access_token = _token;

  RETURN v_orders;
END;
$$;

-- 3) Explicit reveal endpoint for guest orders: token + email match, and mark codes_viewed
CREATE OR REPLACE FUNCTION public.reveal_guest_order_codes(
  _paypal_order_id text,
  _token text,
  _guest_email text
)
RETURNS TABLE(id uuid, game_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF _paypal_order_id IS NULL OR _token IS NULL OR length(_token) < 16
     OR _guest_email IS NULL OR length(_guest_email) < 3 THEN
    RAISE EXCEPTION 'invalid_params';
  END IF;

  SELECT guest_email INTO v_email
  FROM public.orders
  WHERE paypal_order_id = _paypal_order_id
    AND access_token = _token
  LIMIT 1;

  IF v_email IS NULL OR lower(v_email) <> lower(_guest_email) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Mark codes as viewed on first successful reveal (audit trail)
  UPDATE public.orders
  SET codes_viewed = true,
      code_viewed_at = COALESCE(code_viewed_at, now())
  WHERE paypal_order_id = _paypal_order_id
    AND access_token = _token
    AND game_code IS NOT NULL
    AND codes_viewed = false;

  RETURN QUERY
    SELECT o.id, o.game_code
    FROM public.orders o
    WHERE o.paypal_order_id = _paypal_order_id
      AND o.access_token = _token
      AND o.status <> 'held'
      AND o.status <> 'rejected'
      AND o.game_code IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reveal_guest_order_codes(text, text, text) TO anon, authenticated;
