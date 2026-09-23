
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(_coupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE discount_codes
  SET used_count = used_count + 1, updated_at = now()
  WHERE id = _coupon_id;
$$;
