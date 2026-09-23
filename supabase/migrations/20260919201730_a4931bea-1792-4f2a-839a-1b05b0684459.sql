CREATE OR REPLACE FUNCTION public.attach_referral_code(_user_id uuid, _code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _referrer uuid;
  _updated int;
BEGIN
  IF _user_id IS NULL OR _code IS NULL OR btrim(_code) = '' THEN
    RETURN false;
  END IF;

  SELECT user_id INTO _referrer FROM public.referral_codes WHERE code = _code;
  IF _referrer IS NULL OR _referrer = _user_id THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
     SET referred_by_code = _code
   WHERE user_id = _user_id
     AND referred_by_code IS NULL
     AND created_at > now() - interval '15 minutes';

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_referral_code(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.attach_referral_code(uuid, text) TO anon, authenticated;