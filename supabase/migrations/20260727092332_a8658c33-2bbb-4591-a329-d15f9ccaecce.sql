CREATE OR REPLACE FUNCTION public.grant_achievement_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ach RECORD;
  v_code text;
BEGIN
  -- Guard: if this user already has this achievement, do not grant again.
  IF EXISTS (
    SELECT 1 FROM user_achievements
    WHERE user_id = NEW.user_id AND achievement_id = NEW.achievement_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_ach FROM achievements WHERE id = NEW.achievement_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_ach.reward_type = 'coins' THEN
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