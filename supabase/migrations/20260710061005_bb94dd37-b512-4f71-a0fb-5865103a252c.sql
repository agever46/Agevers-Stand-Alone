
-- 1. Leaderboard: drop unrestricted INSERT policy; keep score=0-only policy
DROP POLICY IF EXISTS "Users can insert own leaderboard entries" ON public.game_leaderboard;

-- 2. Game plays: remove direct client INSERT, route through SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Users can insert own plays" ON public.game_plays;

-- 3. record_play RPC — atomically checks availability, inserts play row, returns id + is_paid
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
