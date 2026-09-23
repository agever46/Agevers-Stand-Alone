CREATE OR REPLACE FUNCTION public.reveal_order_codes(_paypal_order_id text)
RETURNS TABLE(id uuid, game_code text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _otp_ok boolean;
  _already_viewed boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE paypal_order_id = _paypal_order_id
      AND user_id = _uid
      AND is_held = true
  ) THEN
    RAISE EXCEPTION 'order_on_hold';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE paypal_order_id = _paypal_order_id
      AND user_id = _uid
      AND codes_viewed = true
  ) INTO _already_viewed;

  IF NOT _already_viewed THEN
    SELECT EXISTS (
      SELECT 1 FROM public.purchase_otp_codes
      WHERE user_id = _uid
        AND used = true
        AND created_at > now() - interval '24 hours'
    ) INTO _otp_ok;

    IF NOT _otp_ok THEN
      RAISE EXCEPTION 'otp_required';
    END IF;
  END IF;

  RETURN QUERY
    SELECT o.id, o.game_code
    FROM public.orders o
    WHERE o.paypal_order_id = _paypal_order_id
      AND o.user_id = _uid
      AND o.is_held = false
      AND o.status <> 'held'
      AND o.status <> 'rejected'
      AND o.status <> 'refunded'
      AND o.status <> 'partially_refunded'
      AND o.game_code IS NOT NULL;
END;
$$;