
-- 1. FIX: Orders INSERT - restrict to safe defaults only (no fake completed orders)
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
CREATE POLICY "Users can insert their own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND game_code IS NULL
    AND is_held = false
    AND price > 0
  );

-- Change default status from 'completed' to 'pending'
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';

-- 2. FIX: play_purchases - remove user UPDATE, create RPC for decrementing
DROP POLICY IF EXISTS "Users can update own purchases" ON public.play_purchases;

-- Create secure RPC to consume a play
CREATE OR REPLACE FUNCTION public.consume_play(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purchase_id uuid;
BEGIN
  -- Find oldest purchase with remaining plays
  SELECT id INTO purchase_id
  FROM play_purchases
  WHERE user_id = _user_id AND plays_remaining > 0
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF purchase_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE play_purchases
  SET plays_remaining = plays_remaining - 1
  WHERE id = purchase_id;

  RETURN true;
END;
$$;
