
-- Remove client INSERT policy on play_purchases
DROP POLICY IF EXISTS "Users can insert own purchases" ON public.play_purchases;

-- Create secure RPC that validates coin balance and creates purchase atomically
CREATE OR REPLACE FUNCTION public.buy_plays_with_coins(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  spent boolean;
BEGIN
  -- Verify caller is the user
  IF auth.uid() != _user_id THEN
    RETURN false;
  END IF;

  -- Spend 50 coins (this checks balance internally)
  SELECT spend_coins(_user_id, 50) INTO spent;
  IF NOT spent THEN
    RETURN false;
  END IF;

  -- Insert purchase with server-controlled values
  INSERT INTO play_purchases (user_id, plays_bought, amount_paid, plays_remaining)
  VALUES (_user_id, 5, 0, 5);

  RETURN true;
END;
$$;
