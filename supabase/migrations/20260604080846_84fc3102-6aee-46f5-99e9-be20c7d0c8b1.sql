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

  -- Validate at least one order for this paypal payment matches the token
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
    'game_code', o.game_code,
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
GRANT EXECUTE ON FUNCTION public.get_guest_orders_by_paypal(text, text) TO anon, authenticated;