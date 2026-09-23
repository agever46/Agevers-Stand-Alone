
-- 1. Fix: Leaderboard exposes user_id publicly
--    Create a public view without user_id, revoke direct public SELECT
CREATE OR REPLACE VIEW public.game_leaderboard_public AS
SELECT id, username, game_type, score, created_at
FROM public.game_leaderboard;

DROP POLICY IF EXISTS "Anyone can view leaderboard" ON public.game_leaderboard;

CREATE POLICY "Users can view own leaderboard entries"
ON public.game_leaderboard
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all leaderboard"
ON public.game_leaderboard
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.game_leaderboard_public TO anon, authenticated;

-- 2. Fix: Sellers can overwrite buyer review ratings
--    Add trigger to protect buyer fields from seller updates
CREATE OR REPLACE FUNCTION public.protect_review_buyer_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If the updater is the seller (not admin), only allow seller_response fields
  IF auth.uid() = OLD.seller_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.rating_product := OLD.rating_product;
    NEW.rating_shipping := OLD.rating_shipping;
    NEW.rating_service := OLD.rating_service;
    NEW.comment := OLD.comment;
    NEW.buyer_id := OLD.buyer_id;
    NEW.order_id := OLD.order_id;
    NEW.seller_id := OLD.seller_id;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_review_buyer_fields
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.protect_review_buyer_fields();

-- 3. Fix: has_role() enumeration - replace with version that only allows checking own role or admin checking others
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Allow checking own roles, or if caller is admin/super_admin
  IF auth.uid() IS NOT NULL AND auth.uid() != _user_id THEN
    -- Only admins can check other users' roles
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    ) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR role = 'super_admin'::app_role)
  );
END;
$$;
