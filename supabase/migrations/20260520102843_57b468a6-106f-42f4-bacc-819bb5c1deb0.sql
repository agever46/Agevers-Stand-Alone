
ALTER TABLE public.giveaways
  ADD COLUMN IF NOT EXISTS prize_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.giveaways
  ADD CONSTRAINT giveaways_prize_count_positive CHECK (prize_count >= 1 AND prize_count <= 50);

DROP INDEX IF EXISTS public.idx_giveaway_prizes_unique_giveaway;

CREATE UNIQUE INDEX IF NOT EXISTS idx_giveaway_prizes_unique_code
  ON public.giveaway_prizes (giveaway_id, game_code);

CREATE INDEX IF NOT EXISTS idx_giveaway_prizes_giveaway
  ON public.giveaway_prizes (giveaway_id);
