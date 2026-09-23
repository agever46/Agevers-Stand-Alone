CREATE TABLE public.giveaway_prizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  giveaway_id UUID NOT NULL,
  winner_user_id UUID NOT NULL,
  winner_email TEXT NOT NULL,
  game_code TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('kinguin', 'manual')),
  cost NUMERIC,
  kinguin_order_id TEXT,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_giveaway_prizes_unique_giveaway ON public.giveaway_prizes(giveaway_id);
CREATE INDEX idx_giveaway_prizes_winner ON public.giveaway_prizes(winner_user_id);

ALTER TABLE public.giveaway_prizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view giveaway prizes"
  ON public.giveaway_prizes FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert giveaway prizes"
  ON public.giveaway_prizes FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update giveaway prizes"
  ON public.giveaway_prizes FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage giveaway prizes"
  ON public.giveaway_prizes FOR ALL
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE TRIGGER update_giveaway_prizes_updated_at
  BEFORE UPDATE ON public.giveaway_prizes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();