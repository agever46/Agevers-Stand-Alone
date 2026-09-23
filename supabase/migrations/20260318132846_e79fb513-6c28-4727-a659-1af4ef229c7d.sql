
CREATE TABLE public.game_leaderboard (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  game_type text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.game_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view leaderboard"
  ON public.game_leaderboard FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert own scores"
  ON public.game_leaderboard FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_leaderboard_score ON public.game_leaderboard (score DESC);
CREATE INDEX idx_leaderboard_game ON public.game_leaderboard (game_type);
