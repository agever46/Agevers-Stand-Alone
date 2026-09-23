REVOKE EXECUTE ON FUNCTION public.spend_coins(uuid, integer) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.spend_coins(_user_id uuid, _amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance numeric;
BEGIN
  -- Hardening (2026-09-08): callers may only spend their own coins unless
  -- running as service_role / internal SECURITY DEFINER context.
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RETURN false;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.spend_coins(uuid, integer) FROM anon, authenticated;