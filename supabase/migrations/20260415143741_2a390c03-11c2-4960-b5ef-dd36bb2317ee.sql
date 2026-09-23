
-- Referral codes table
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  total_referrals integer NOT NULL DEFAULT 0,
  total_coins_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own referral code" ON public.referral_codes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage referral codes" ON public.referral_codes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role can manage referral codes" ON public.referral_codes FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Referral completions table
CREATE TABLE public.referral_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  coins_awarded integer NOT NULL DEFAULT 50,
  trigger_order_id uuid REFERENCES public.orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

ALTER TABLE public.referral_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON public.referral_completions FOR SELECT TO authenticated USING (referrer_id = auth.uid());
CREATE POLICY "Admins can manage referral completions" ON public.referral_completions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role can manage referral completions" ON public.referral_completions FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Store which referral code was used at signup (on profiles)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_code text;

-- Function to complete a referral (called from fulfill-order edge function)
CREATE OR REPLACE FUNCTION public.complete_referral(_referred_user_id uuid, _order_id uuid, _coins integer DEFAULT 50)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer_id uuid;
  _ref_code text;
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

  -- Insert completion
  INSERT INTO referral_completions (referrer_id, referred_user_id, coins_awarded, trigger_order_id)
  VALUES (_referrer_id, _referred_user_id, _coins, _order_id);

  -- Update stats
  UPDATE referral_codes SET total_referrals = total_referrals + 1, total_coins_earned = total_coins_earned + _coins WHERE code = _ref_code;

  -- Award coins
  INSERT INTO user_coins (user_id, balance, total_earned)
  VALUES (_referrer_id, _coins, _coins)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_coins.balance + _coins, total_earned = user_coins.total_earned + _coins, updated_at = now();

  RETURN true;
END;
$$;
