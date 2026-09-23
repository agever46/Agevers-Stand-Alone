
-- 1. Reviews: remove raw seller UPDATE grant, replace with narrow RPC
DROP POLICY IF EXISTS "Sellers can respond to their reviews" ON public.reviews;

CREATE OR REPLACE FUNCTION public.seller_respond_to_review(_review_id uuid, _response text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _seller uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _response IS NULL OR length(btrim(_response)) = 0 THEN
    RAISE EXCEPTION 'Response cannot be empty';
  END IF;
  IF length(_response) > 1000 THEN
    RAISE EXCEPTION 'Response too long';
  END IF;

  SELECT seller_id INTO _seller FROM public.reviews WHERE id = _review_id;
  IF _seller IS NULL OR _seller IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.reviews
     SET seller_response = btrim(_response),
         seller_responded_at = now()
   WHERE id = _review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_respond_to_review(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.seller_respond_to_review(uuid, text) TO authenticated;

-- 2. Profiles: restrict self-update to non-privileged columns at the policy level
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.profile_sensitive_unchanged(_profile_id uuid, _account_status text, _email_verified boolean, _suspended_at timestamptz, _fake_sales_boost integer, _referred_by_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _profile_id
      AND p.account_status IS NOT DISTINCT FROM _account_status
      AND p.email_verified IS NOT DISTINCT FROM _email_verified
      AND p.suspended_at IS NOT DISTINCT FROM _suspended_at
      AND p.fake_sales_boost IS NOT DISTINCT FROM _fake_sales_boost
      AND p.referred_by_code IS NOT DISTINCT FROM _referred_by_code
  );
$$;

REVOKE ALL ON FUNCTION public.profile_sensitive_unchanged(uuid, text, boolean, timestamptz, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.profile_sensitive_unchanged(uuid, text, boolean, timestamptz, integer, text) TO authenticated;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND public.profile_sensitive_unchanged(id, account_status, email_verified, suspended_at, fake_sales_boost, referred_by_code)
);
