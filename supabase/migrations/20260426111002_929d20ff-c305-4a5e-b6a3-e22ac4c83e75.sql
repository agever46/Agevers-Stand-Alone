
-- ============================================
-- ACHIEVEMENTS SYSTEM
-- ============================================

-- 1. Catalog table
CREATE TABLE public.achievements (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  criteria_type text NOT NULL CHECK (criteria_type IN ('signup','order_count','total_spent')),
  criteria_value numeric NOT NULL,
  reward_type text NOT NULL CHECK (reward_type IN ('coins','coupon')),
  reward_value numeric NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active achievements"
ON public.achievements FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage achievements"
ON public.achievements FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. User unlocks table
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id text NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  reward_claimed boolean NOT NULL DEFAULT false,
  reward_metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
ON public.user_achievements FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages user achievements"
ON public.user_achievements FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;
ALTER TABLE public.user_achievements REPLICA IDENTITY FULL;

-- 3. Seed achievements
INSERT INTO public.achievements (id, title, description, icon, criteria_type, criteria_value, reward_type, reward_value, display_order) VALUES
('welcome',           'Welcome Aboard',     'Create your account and join the community', '🎉', 'signup',       0,   'coins',  10,  1),
('first_purchase',    'First Purchase',     'Make your first order',                       '🛒', 'order_count',  1,   'coins',  50,  2),
('returning_customer','Returning Customer', 'Complete 3 orders',                            '🔁', 'order_count',  3,   'coins',  100, 3),
('loyal_gamer',       'Loyal Gamer',        'Complete 5 orders',                            '🎮', 'order_count',  5,   'coupon', 5,   4),
('power_buyer',       'Power Buyer',        'Complete 10 orders',                           '🏆', 'order_count',  10,  'coins',  250, 5),
('vip_shopper',       'VIP Shopper',        'Complete 25 orders',                           '💎', 'order_count',  25,  'coupon', 10,  6),
('big_spender',       'Big Spender',        'Spend €100 in total',                          '💰', 'total_spent',  100, 'coins',  150, 7),
('whale',             'Whale',              'Spend €500 in total',                          '🐋', 'total_spent',  500, 'coupon', 15,  8);

-- 4. Helper: generate unique coupon code
CREATE OR REPLACE FUNCTION public.generate_achievement_coupon_code(p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_exists boolean;
  v_attempts int := 0;
BEGIN
  LOOP
    v_code := upper(p_prefix) || '-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM discount_codes WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists OR v_attempts > 10;
    v_attempts := v_attempts + 1;
  END LOOP;
  RETURN v_code;
END;
$$;

-- 5. Trigger: grant reward on unlock
CREATE OR REPLACE FUNCTION public.grant_achievement_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ach RECORD;
  v_code text;
  v_user_email text;
BEGIN
  SELECT * INTO v_ach FROM achievements WHERE id = NEW.achievement_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_ach.reward_type = 'coins' THEN
    -- Add Blaze Coins
    INSERT INTO user_coins (user_id, balance, total_earned)
    VALUES (NEW.user_id, v_ach.reward_value, v_ach.reward_value)
    ON CONFLICT (user_id) DO UPDATE
    SET balance = user_coins.balance + v_ach.reward_value,
        total_earned = user_coins.total_earned + v_ach.reward_value,
        updated_at = now();
    NEW.reward_metadata := jsonb_build_object('coins_awarded', v_ach.reward_value);
    NEW.reward_claimed := true;

  ELSIF v_ach.reward_type = 'coupon' THEN
    v_code := generate_achievement_coupon_code(v_ach.id);
    INSERT INTO discount_codes (code, discount_type, discount_value, max_uses, used_count, is_active, expires_at, min_order_amount)
    VALUES (v_code, 'percentage', v_ach.reward_value, 1, 0, true, now() + interval '30 days', 0);
    NEW.reward_metadata := jsonb_build_object('coupon_code', v_code, 'discount_percent', v_ach.reward_value, 'expires_in_days', 30);
    NEW.reward_claimed := true;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_achievements_grant_reward
BEFORE INSERT ON public.user_achievements
FOR EACH ROW
EXECUTE FUNCTION public.grant_achievement_reward();

-- 6. Recalculate user achievements
CREATE OR REPLACE FUNCTION public.recalculate_user_achievements(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_count int;
  v_total_spent numeric;
  v_ach RECORD;
BEGIN
  -- Distinct orders by paypal_order_id (one cart = one order), only completed
  SELECT 
    COUNT(DISTINCT COALESCE(paypal_order_id, id::text)),
    COALESCE(SUM(price * COALESCE(quantity,1)), 0)
  INTO v_order_count, v_total_spent
  FROM orders
  WHERE user_id = p_user_id
    AND status IN ('completed','paid','delivered');

  FOR v_ach IN SELECT * FROM achievements WHERE is_active = true AND criteria_type IN ('order_count','total_spent') LOOP
    IF (v_ach.criteria_type = 'order_count' AND v_order_count >= v_ach.criteria_value)
       OR (v_ach.criteria_type = 'total_spent' AND v_total_spent >= v_ach.criteria_value) THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_ach.id)
      ON CONFLICT (user_id, achievement_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- 7. Trigger on orders
CREATE OR REPLACE FUNCTION public.trigger_recalc_achievements_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed','paid','delivered') AND NEW.user_id IS NOT NULL THEN
    PERFORM recalculate_user_achievements(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_achievements_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalc_achievements_on_order();

CREATE TRIGGER trg_orders_achievements_update
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (NEW.status IN ('completed','paid','delivered') AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.trigger_recalc_achievements_on_order();

-- 8. Trigger on profile creation → welcome achievement
CREATE OR REPLACE FUNCTION public.grant_welcome_achievement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_achievements (user_id, achievement_id)
  VALUES (NEW.user_id, 'welcome')
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_welcome_achievement
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.grant_welcome_achievement();

-- 9. Backfill existing users
DO $$
DECLARE r RECORD;
BEGIN
  -- Welcome achievement for all existing profiles
  FOR r IN SELECT user_id FROM profiles LOOP
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (r.user_id, 'welcome')
    ON CONFLICT DO NOTHING;
  END LOOP;
  -- Recalculate purchase-based for everyone with orders
  FOR r IN SELECT DISTINCT user_id FROM orders WHERE user_id IS NOT NULL LOOP
    PERFORM recalculate_user_achievements(r.user_id);
  END LOOP;
END $$;
