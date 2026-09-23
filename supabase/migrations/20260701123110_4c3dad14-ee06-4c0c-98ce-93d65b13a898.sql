
-- 1) Generated flag column so UI can distinguish delivered vs pending without seeing the code
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS code_delivered boolean
  GENERATED ALWAYS AS (game_code IS NOT NULL AND length(btrim(game_code)) > 0) STORED;

-- 2) Revoke direct SELECT of game_code from regular API roles.
-- The column stays intact; only service_role (edge functions) and the SECURITY DEFINER
-- RPC below can read it.
REVOKE SELECT (game_code) ON public.orders FROM anon;
REVOKE SELECT (game_code) ON public.orders FROM authenticated;

-- 3) SECURITY DEFINER RPC that returns a buyer's own codes only after a used
-- purchase_otp exists in the last 24 hours (mirrors the frontend OTP gate).
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
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.purchase_otp_codes
    WHERE user_id = _uid
      AND used = true
      AND created_at > now() - interval '24 hours'
  ) INTO _otp_ok;

  IF NOT _otp_ok THEN
    RAISE EXCEPTION 'otp_required';
  END IF;

  RETURN QUERY
    SELECT o.id, o.game_code
    FROM public.orders o
    WHERE o.paypal_order_id = _paypal_order_id
      AND o.user_id = _uid
      AND o.status <> 'held'
      AND o.status <> 'rejected'
      AND o.game_code IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_order_codes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reveal_order_codes(text) TO authenticated;

-- 4) Kinguin products: hide supplier cost and internal ops fields from anonymous storefront.
-- Authenticated (admin/seller) users keep full access via their existing RLS policies.
REVOKE SELECT ON public.kinguin_products FROM anon;
GRANT SELECT (id, allowed_product_id, kinguin_product_id, sell_price, is_active, created_at, updated_at)
  ON public.kinguin_products TO anon;
