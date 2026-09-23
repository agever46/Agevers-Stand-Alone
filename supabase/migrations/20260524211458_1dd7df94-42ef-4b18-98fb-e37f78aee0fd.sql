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
  IF _amount < -500 OR _amount > 500 THEN
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