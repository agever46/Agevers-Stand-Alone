-- Allow new criteria types for game-based achievements
ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_criteria_type_check;
ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_criteria_type_check
  CHECK (criteria_type IN ('signup', 'order_count', 'total_spent', 'games_played', 'coins_won'));

-- Add game-based achievements
INSERT INTO public.achievements (id, title, description, icon, criteria_type, criteria_value, reward_type, reward_value, display_order, is_active)
VALUES
  ('first_play',     'First Spin',      'Play your first game on Agever''s',     '🎮', 'games_played',    1, 'coins',  10, 100, true),
  ('game_enthusiast','Game Enthusiast', 'Play 10 games on Agever''s',            '🕹️', 'games_played',   10, 'coins',  50, 110, true),
  ('arcade_master',  'Arcade Master',   'Play 50 games on Agever''s',            '🎯', 'games_played',   50, 'coins', 200, 120, true),
  ('coin_collector', 'Coin Collector',  'Win 500 Blaze Coins from games',        '🪙', 'coins_won',     500, 'coins', 100, 130, true),
  ('jackpot_hunter', 'Jackpot Hunter',  'Win 2,500 Blaze Coins from games',      '💎', 'coins_won',    2500, 'coupon',  5, 140, true),
  ('high_roller',    'High Roller',     'Win 10,000 Blaze Coins from games',     '👑', 'coins_won',   10000, 'coupon', 10, 150, true)
ON CONFLICT (id) DO NOTHING;