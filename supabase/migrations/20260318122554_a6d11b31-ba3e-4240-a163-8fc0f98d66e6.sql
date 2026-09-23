
-- User coins balance
CREATE TABLE public.user_coins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coins" ON public.user_coins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own coins" ON public.user_coins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own coins" ON public.user_coins
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Game plays tracking
CREATE TABLE public.game_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_type text NOT NULL,
  coins_won integer NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_plays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plays" ON public.game_plays
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plays" ON public.game_plays
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Paid play packages
CREATE TABLE public.play_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plays_bought integer NOT NULL DEFAULT 5,
  amount_paid numeric NOT NULL DEFAULT 2,
  plays_remaining integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.play_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases" ON public.play_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases" ON public.play_purchases
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchases" ON public.play_purchases
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins can manage all
CREATE POLICY "Admins manage coins" ON public.user_coins FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage plays" ON public.game_plays FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage purchases" ON public.play_purchases FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
