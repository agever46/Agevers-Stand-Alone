CREATE OR REPLACE FUNCTION public.reveal_order_codes(_paypal_order_id text, _access_token text DEFAULT NULL::text)
RETURNS TABLE(id uuid, game_code text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _otp_ok boolean;
  _already_viewed boolean;
  _order_exists boolean;
  _guest_email text;
BEGIN
  -- 1. Identify if this is a guest or user request and verify ownership
  IF _uid IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE paypal_order_id = _paypal_order_id AND user_id = _uid
    ) INTO _order_exists;

    IF NOT _order_exists THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  ELSIF _access_token IS NOT NULL AND length(_access_token) >= 16 THEN
    SELECT o.guest_email FROM public.orders o
    WHERE o.paypal_order_id = _paypal_order_id AND o.access_token = _access_token
    LIMIT 1 INTO _guest_email;

    IF _guest_email IS NULL THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  ELSE
    RAISE EXCEPTION 'authentication_required';
  END IF;

  -- 2. Check for hold status
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE paypal_order_id = _paypal_order_id
      AND (
        (_uid IS NOT NULL AND user_id = _uid) OR
        (_access_token IS NOT NULL AND access_token = _access_token)
      )
      AND is_held = true
  ) THEN
    RAISE EXCEPTION 'order_on_hold';
  END IF;

  -- 3. Check if already viewed (skip OTP if so)
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE paypal_order_id = _paypal_order_id
      AND (
        (_uid IS NOT NULL AND user_id = _uid) OR
        (_access_token IS NOT NULL AND access_token = _access_token)
      )
      AND codes_viewed = true
  ) INTO _already_viewed;

  -- 4. Verify OTP if not already viewed
  IF NOT _already_viewed THEN
    IF _uid IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.purchase_otp_codes
        WHERE user_id = _uid
          AND used = true
          AND created_at > now() - interval '24 hours'
      ) INTO _otp_ok;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.purchase_otp_codes
        WHERE phone = _guest_email
          AND used = true
          AND created_at > now() - interval '24 hours'
      ) INTO _otp_ok;
    END IF;

    IF NOT _otp_ok THEN
      RAISE EXCEPTION 'otp_required';
    END IF;
  END IF;

  -- 5. Return the codes (never for refunded orders)
  RETURN QUERY
    SELECT o.id, o.game_code
    FROM public.orders o
    WHERE o.paypal_order_id = _paypal_order_id
      AND (
        (_uid IS NOT NULL AND o.user_id = _uid) OR
        (_access_token IS NOT NULL AND o.access_token = _access_token)
      )
      AND o.is_held = false
      AND o.status <> 'held'
      AND o.status <> 'rejected'
      AND o.status <> 'refunded'
      AND o.status <> 'partially_refunded'
      AND o.game_code IS NOT NULL;
END;
$function$;