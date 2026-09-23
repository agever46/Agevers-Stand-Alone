CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _amount numeric,
  _method text,
  _email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _available numeric;
  _pending numeric;
  _min numeric;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(_uid, 'seller'::app_role) THEN
    RAISE EXCEPTION 'Not a seller';
  END IF;
  IF _method NOT IN ('paypal', 'payoneer') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF _email IS NULL OR position('@' in _email) = 0 OR length(_email) > 255 THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  _min := CASE WHEN _method = 'payoneer' THEN 100 ELSE 60 END;
  IF _amount IS NULL OR _amount < _min THEN
    RAISE EXCEPTION 'Minimum withdrawal is %', _min;
  END IF;

  SELECT COALESCE(sum(net_earnings), 0) INTO _available
  FROM public.seller_sales
  WHERE seller_id = _uid AND available_at <= now();

  SELECT COALESCE(sum(amount), 0) INTO _pending
  FROM public.withdrawal_requests
  WHERE seller_id = _uid AND status IN ('pending', 'approved', 'completed');

  IF _amount > (_available - _pending) THEN
    RAISE EXCEPTION 'Amount exceeds available balance';
  END IF;

  INSERT INTO public.withdrawal_requests (seller_id, amount, method, paypal_email, payoneer_email)
  VALUES (
    _uid,
    _amount,
    _method,
    CASE WHEN _method = 'paypal' THEN _email ELSE NULL END,
    CASE WHEN _method = 'payoneer' THEN _email ELSE NULL END
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text) TO authenticated;

DROP POLICY IF EXISTS "Sellers can request withdrawals" ON public.withdrawal_requests;