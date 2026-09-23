
-- 1) aliexpress_config: add admin INSERT/DELETE policies and service_role full-access policy
CREATE POLICY "Only admins can insert aliexpress_config"
ON public.aliexpress_config FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete aliexpress_config"
ON public.aliexpress_config FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access aliexpress_config"
ON public.aliexpress_config FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 2) game_leaderboard: add INSERT policy for own entries
CREATE POLICY "Users can insert own leaderboard entries"
ON public.game_leaderboard FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3) product_keys: restrict seller SELECT so unsold key_codes are not exposed in bulk.
-- Admin role retains full access via the existing "Admins can manage all keys" ALL policy.
DROP POLICY IF EXISTS "Sellers can view their own keys" ON public.product_keys;
CREATE POLICY "Sellers can view their own keys"
ON public.product_keys FOR SELECT TO authenticated
USING (
  seller_id = auth.uid()
  AND public.has_role(auth.uid(), 'seller'::app_role)
  AND (status = 'sold' OR public.has_role(auth.uid(), 'admin'::app_role))
);
