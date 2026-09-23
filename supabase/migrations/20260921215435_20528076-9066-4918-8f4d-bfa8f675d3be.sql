CREATE OR REPLACE FUNCTION public.get_seller_for_order(_order_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT pk.seller_id
  FROM public.product_keys pk
  JOIN public.orders o ON o.id = pk.order_id
  WHERE pk.order_id = _order_id
    AND (
      o.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  LIMIT 1
$function$;

REVOKE EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) TO service_role;

ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders (id, user_id, game_title, platform, price, status, created_at, paypal_order_id, quantity, image_url, codes_viewed, buyer_country, buyer_city, code_viewed_at, is_held, held_until, held_reason, approved_by, approved_at, shipping_full_name, shipping_city, shipping_state, shipping_country, tracking_number, tracking_url, carrier_name, shipped_at, aliexpress_order_id, pending_kinguin, review_invite_sent_at, review_reward_sent_at);