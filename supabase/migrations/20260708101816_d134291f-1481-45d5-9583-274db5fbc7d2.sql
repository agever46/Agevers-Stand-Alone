
-- game_leaderboard: users may only self-insert with score = 0 (real scores are written by submit_game_score SECURITY DEFINER)
DROP POLICY IF EXISTS "Users can insert own scores" ON public.game_leaderboard;
DROP POLICY IF EXISTS "Users can insert their own scores" ON public.game_leaderboard;
CREATE POLICY "Users can insert own scores"
ON public.game_leaderboard
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND score = 0);

-- referral_codes: users may only self-insert with zero stats
DROP POLICY IF EXISTS "Users can insert own referral code" ON public.referral_codes;
CREATE POLICY "Users can insert own referral code"
ON public.referral_codes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND COALESCE(total_coins_earned, 0) = 0
  AND COALESCE(total_referrals, 0) = 0
);

-- Also prevent users from updating their own referral_codes to inflate stats.
-- Only admins / service role can update (existing policies already cover that).
DROP POLICY IF EXISTS "Users can update own referral code" ON public.referral_codes;
