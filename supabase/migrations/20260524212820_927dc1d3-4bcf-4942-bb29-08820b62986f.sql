DROP POLICY IF EXISTS "Users can insert own plays" ON public.game_plays;

CREATE POLICY "Users can insert own plays"
ON public.game_plays
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND coins_won = 0
);