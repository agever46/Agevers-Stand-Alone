-- EMERGENCY, TEMPORARY: a user got 500 coins again (2026-09-08) despite the
-- 2026-09-07 hardening (complete_referral locked to service_role + fixed
-- reward, add_coins capped at 100, record_play race fixed). 500 matches the
-- OLD pre-hardening cap exactly, which means there is still an unknown path
-- to mint coins we have not found yet — possibly another stale/duplicate
-- function overload, mirroring the one Lovable found on reveal_order_codes
-- the same day. Per explicit instruction, every coin-earning and
-- coin-spending path is disabled site-wide until the real root cause is
-- found. This is intentionally reversible — revert this migration (or the
-- individual function bodies) once resolved.

CREATE OR REPLACE FUNCTION public.add_coins(_user_id uuid, _amount integer, _game_play_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Blaze Coins temporarily disabled site-wide — see migration comment.
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_referral(_referred_user_id uuid, _order_id uuid, _coins integer DEFAULT 50)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Blaze Coins temporarily disabled site-wide — see migration comment.
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_plays_with_coins(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Blaze Coins temporarily disabled site-wide — see migration comment.
  RETURN false;
END;
$$;

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
  IF EXISTS (
    SELECT 1 FROM user_achievements
    WHERE user_id = NEW.user_id AND achievement_id = NEW.achievement_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_ach FROM achievements WHERE id = NEW.achievement_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_ach.reward_type = 'coins' THEN
    -- Blaze Coins temporarily disabled site-wide — see migration comment.
    -- Achievement still unlocks; the coin payout is deferred (reward_claimed
    -- stays false so it can be reconciled once coins are re-enabled).
    NULL;

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
