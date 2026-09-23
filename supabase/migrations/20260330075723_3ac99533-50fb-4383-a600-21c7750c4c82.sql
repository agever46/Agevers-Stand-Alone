
-- 1. FIX: kinguin_products public cost exposure
-- Create a public view that excludes sensitive cost/supplier columns
CREATE OR REPLACE VIEW public.kinguin_products_public AS
SELECT id, allowed_product_id, sell_price, kinguin_stock, is_active
FROM public.kinguin_products
WHERE is_active = true;

-- Remove the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view active kinguin products" ON public.kinguin_products;

-- Add restricted SELECT: only admins and service_role can see full table
CREATE POLICY "Admins can view all kinguin products"
ON public.kinguin_products FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow service role full access for edge functions
CREATE POLICY "Service role can read kinguin products"
ON public.kinguin_products FOR SELECT TO public
USING (auth.role() = 'service_role'::text);

-- Grant public SELECT on the safe view
GRANT SELECT ON public.kinguin_products_public TO anon, authenticated;

-- 2. FIX: user_coins direct manipulation
-- Remove the dangerous UPDATE policy
DROP POLICY IF EXISTS "Users can update own coins" ON public.user_coins;

-- Remove direct INSERT policy (should go through RPCs)
DROP POLICY IF EXISTS "Users can insert own coins" ON public.user_coins;

-- Create secure RPC: add_coins (called after game play)
CREATE OR REPLACE FUNCTION public.add_coins(_user_id uuid, _amount integer, _game_play_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount <= 0 OR _amount > 500 THEN
    RAISE EXCEPTION 'Invalid coin amount';
  END IF;
  
  -- Verify the game play exists, belongs to user, and has matching coins_won
  IF NOT EXISTS (
    SELECT 1 FROM game_plays
    WHERE id = _game_play_id AND user_id = _user_id AND coins_won = _amount
  ) THEN
    RAISE EXCEPTION 'Invalid game play record';
  END IF;
  
  -- Upsert coins
  INSERT INTO user_coins (user_id, balance, total_earned)
  VALUES (_user_id, _amount, _amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_coins.balance + _amount,
      total_earned = user_coins.total_earned + _amount,
      updated_at = now();
END;
$$;

-- Create secure RPC: spend_coins
CREATE OR REPLACE FUNCTION public.spend_coins(_user_id uuid, _amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
BEGIN
  IF _amount <= 0 THEN
    RETURN false;
  END IF;
  
  SELECT balance INTO current_balance
  FROM user_coins WHERE user_id = _user_id FOR UPDATE;
  
  IF current_balance IS NULL OR current_balance < _amount THEN
    RETURN false;
  END IF;
  
  UPDATE user_coins
  SET balance = balance - _amount,
      total_spent = total_spent + _amount,
      updated_at = now()
  WHERE user_id = _user_id;
  
  RETURN true;
END;
$$;

-- 3. FIX: leaderboard score spoofing
-- Remove direct INSERT policy
DROP POLICY IF EXISTS "Users can insert own scores" ON public.game_leaderboard;

-- Create secure RPC to submit scores linked to game_plays
CREATE OR REPLACE FUNCTION public.submit_game_score(_game_play_id uuid, _username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  play_record RECORD;
BEGIN
  -- Verify play exists and belongs to caller
  SELECT * INTO play_record FROM game_plays
  WHERE id = _game_play_id AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid game play';
  END IF;
  
  IF play_record.coins_won <= 0 THEN
    RETURN; -- No score to submit
  END IF;
  
  -- Check no duplicate submission for this play
  IF EXISTS (SELECT 1 FROM game_leaderboard WHERE id = _game_play_id) THEN
    RETURN;
  END IF;
  
  INSERT INTO game_leaderboard (id, user_id, username, game_type, score)
  VALUES (_game_play_id, auth.uid(), _username, play_record.game_type, play_record.coins_won);
END;
$$;

-- 4. FIX: orders missing admin SELECT
CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also add admin UPDATE for order management
CREATE POLICY "Admins can update all orders"
ON public.orders FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. FIX: ticket-screenshots bucket - make private
UPDATE storage.buckets SET public = false WHERE id = 'ticket-screenshots';
