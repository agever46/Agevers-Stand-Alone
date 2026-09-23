-- Incident response for a confirmed coin-farming exploit (20 accounts
-- created within a 78-second window on 2026-07-19, totaling ~10.5M coins
-- never spent, plus a fresh single-account case on 2026-09-06).
--
-- Fix 1: add_coins trusted the client-supplied _amount up to +/-500 per
-- credit, with no validation against what the specific game_type could
-- legitimately award. 500 was far above any game's real per-play payout
-- (CoinFlip tops out at 40, Dice at 15) — lowering the hard ceiling to 100
-- shrinks the blast radius of this still-open trust issue while a proper
-- server-authoritative reward redesign is planned separately.
--
-- Fix 2: record_play's "2 free plays per 24h" check was a plain
-- SELECT COUNT(*) then INSERT, with no lock serializing concurrent calls
-- from the same user. A burst of concurrent requests (trivial to script)
-- could all read the same pre-insert count and all pass the check,
-- creating far more than 2 eligible game_plays rows per day — each then
-- creditable via add_coins. This is the most likely mechanism for the
-- July 19 mass exploit. Adding a per-user advisory lock serializes calls
-- from the same user so each sees the previous call's committed count.
CREATE OR REPLACE FUNCTION public.add_coins(_user_id uuid, _amount integer, _game_play_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  play_record RECORD;
BEGIN
  IF _amount = 0 THEN
    RETURN;
  END IF;
  IF _amount < -100 OR _amount > 100 THEN
    RAISE EXCEPTION 'Invalid coin amount';
  END IF;

  -- Verify the game play exists and belongs to user
  SELECT * INTO play_record FROM game_plays
  WHERE id = _game_play_id AND user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid game play record';
  END IF;

  -- Prevent double-crediting the same play
  IF COALESCE(play_record.coins_won, 0) <> 0 THEN
    RAISE EXCEPTION 'Coins already credited for this play';
  END IF;

  -- Stamp coins_won on the play row
  UPDATE game_plays SET coins_won = _amount WHERE id = _game_play_id;

  -- Upsert coins balance (only positive earnings count toward total_earned)
  INSERT INTO user_coins (user_id, balance, total_earned)
  VALUES (_user_id, GREATEST(_amount, 0), GREATEST(_amount, 0))
  ON CONFLICT (user_id) DO UPDATE
  SET balance = GREATEST(user_coins.balance + _amount, 0),
      total_earned = user_coins.total_earned + GREATEST(_amount, 0),
      updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_play(_game_type text)
RETURNS TABLE(play_id uuid, used_paid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _since timestamptz := now() - interval '24 hours';
  _free_used integer;
  _paid_left integer;
  _use_paid boolean;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF _game_type IS NULL OR length(_game_type) = 0 OR length(_game_type) > 32 THEN
    RAISE EXCEPTION 'invalid game_type';
  END IF;

  -- Serialize concurrent calls from the same user so the free-play count
  -- below always reflects every previously-committed call, closing a race
  -- where a burst of parallel requests could all pass the check at once.
  PERFORM pg_advisory_xact_lock(hashtext(_uid::text));

  SELECT COUNT(*) INTO _free_used
  FROM public.game_plays
  WHERE user_id = _uid AND is_paid = false AND created_at >= _since;

  SELECT COALESCE(SUM(plays_remaining), 0) INTO _paid_left
  FROM public.play_purchases
  WHERE user_id = _uid AND plays_remaining > 0;

  IF _free_used >= 2 AND _paid_left <= 0 THEN
    RAISE EXCEPTION 'no_plays_available';
  END IF;

  _use_paid := (_free_used >= 2);

  IF _use_paid THEN
    IF NOT public.consume_play(_uid) THEN
      RAISE EXCEPTION 'no_plays_available';
    END IF;
  END IF;

  INSERT INTO public.game_plays (user_id, game_type, coins_won, is_paid)
  VALUES (_uid, _game_type, 0, _use_paid)
  RETURNING id INTO _new_id;

  play_id := _new_id;
  used_paid := _use_paid;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_play(text) TO authenticated;

-- Fix 3 (the actual mechanism, confirmed — these 20 accounts have zero
-- game_plays rows at all): complete_referral had no GRANT/REVOKE at all,
-- so Postgres' default (EXECUTE granted to PUBLIC on function creation)
-- left it callable directly by any authenticated client via supabase.rpc,
-- not just from the trusted fulfill-order edge function. Worse, `_coins`
-- was a caller-supplied parameter with no bounds check, and `_order_id`
-- is a nullable FK never verified to belong to the referred user or even
-- be a real completed order. A single direct RPC call — set up one alt
-- account referred by your own code, then call
-- complete_referral(that_alt_id, null, 1045560) — mints coins in one
-- shot, no game involved at all. This fully explains the July 19 pattern:
-- 20 accounts, zero game_plays rows, balance == total_earned (one-shot
-- credit), huge arbitrary-looking amounts.
--
-- Fix: hardcode the reward server-side (ignore the caller's _coins
-- entirely) and restrict execution to service_role only, matching how
-- it's actually used (fulfill-order calls it with the service-role key).
CREATE OR REPLACE FUNCTION public.complete_referral(_referred_user_id uuid, _order_id uuid, _coins integer DEFAULT 50)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer_id uuid;
  _ref_code text;
  _reward_coins CONSTANT integer := 50;
BEGIN
  -- Find referral code used by this user
  SELECT referred_by_code INTO _ref_code FROM profiles WHERE user_id = _referred_user_id;
  IF _ref_code IS NULL THEN RETURN false; END IF;

  -- Already completed?
  IF EXISTS (SELECT 1 FROM referral_completions WHERE referred_user_id = _referred_user_id) THEN
    RETURN false;
  END IF;

  -- Find referrer
  SELECT user_id INTO _referrer_id FROM referral_codes WHERE code = _ref_code;
  IF _referrer_id IS NULL THEN RETURN false; END IF;

  -- Cannot refer yourself
  IF _referrer_id = _referred_user_id THEN RETURN false; END IF;

  -- Insert completion (fixed reward — _coins argument is intentionally ignored)
  INSERT INTO referral_completions (referrer_id, referred_user_id, coins_awarded, trigger_order_id)
  VALUES (_referrer_id, _referred_user_id, _reward_coins, _order_id);

  -- Update stats
  UPDATE referral_codes SET total_referrals = total_referrals + 1, total_coins_earned = total_coins_earned + _reward_coins WHERE code = _ref_code;

  -- Award coins
  INSERT INTO user_coins (user_id, balance, total_earned)
  VALUES (_referrer_id, _reward_coins, _reward_coins)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_coins.balance + _reward_coins, total_earned = user_coins.total_earned + _reward_coins, updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_referral(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_referral(uuid, uuid, integer) TO service_role;
