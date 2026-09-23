
-- 1. Create secure function to validate discount codes (replaces client-side SELECT)
CREATE OR REPLACE FUNCTION public.validate_discount_code(_code text, _order_total numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dc record;
BEGIN
  SELECT * INTO dc FROM discount_codes
  WHERE code = _code AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid discount code');
  END IF;

  IF dc.expires_at IS NOT NULL AND dc.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This code has expired');
  END IF;

  IF dc.max_uses IS NOT NULL AND dc.used_count >= dc.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This code has reached its usage limit');
  END IF;

  IF dc.min_order_amount IS NOT NULL AND _order_total < dc.min_order_amount THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Minimum order amount: €' || dc.min_order_amount);
  END IF;

  IF dc.max_order_amount IS NOT NULL AND dc.max_order_amount > 0 AND _order_total > dc.max_order_amount THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Maximum order amount: €' || dc.max_order_amount);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', dc.id,
    'discount_type', dc.discount_type,
    'discount_value', dc.discount_value
  );
END;
$$;

-- 2. Remove the public SELECT policy on discount_codes (admins keep full access via ALL)
DROP POLICY IF EXISTS "Authenticated users can view active codes" ON discount_codes;

-- 3. Fix product-images upload policy to require seller role
DROP POLICY IF EXISTS "Sellers can upload product images" ON storage.objects;
CREATE POLICY "Sellers can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND has_role(auth.uid(), 'seller'::app_role)
);
