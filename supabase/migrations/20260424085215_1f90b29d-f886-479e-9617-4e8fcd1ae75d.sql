-- Giveaways table: one giveaway runs at a time
CREATE TABLE public.giveaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  allowed_product_id UUID REFERENCES public.allowed_products(id) ON DELETE SET NULL,
  prize_image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','drawn')),
  winner_user_id UUID,
  winner_email TEXT,
  winner_announced_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_giveaways_status ON public.giveaways(status);
CREATE INDEX idx_giveaways_ends_at ON public.giveaways(ends_at);

-- Entries table: who joined which giveaway
CREATE TABLE public.giveaway_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id UUID NOT NULL REFERENCES public.giveaways(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  entry_count INTEGER NOT NULL DEFAULT 1,
  bonus_from_orders INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(giveaway_id, user_id)
);

CREATE INDEX idx_giveaway_entries_giveaway ON public.giveaway_entries(giveaway_id);
CREATE INDEX idx_giveaway_entries_user ON public.giveaway_entries(user_id);

-- Enable RLS
ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_entries ENABLE ROW LEVEL SECURITY;

-- Giveaways policies
CREATE POLICY "Anyone can view giveaways"
  ON public.giveaways FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage giveaways"
  ON public.giveaways FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Entries policies
CREATE POLICY "Users can view own entries"
  ON public.giveaway_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public count visibility"
  ON public.giveaway_entries FOR SELECT
  USING (true);

CREATE POLICY "Users can join giveaways"
  ON public.giveaway_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND entry_count = 1
    AND bonus_from_orders = 0
    AND EXISTS (
      SELECT 1 FROM public.giveaways g
      WHERE g.id = giveaway_id
        AND g.status = 'active'
        AND now() BETWEEN g.starts_at AND g.ends_at
    )
  );

CREATE POLICY "Admins can manage entries"
  ON public.giveaway_entries FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to bump entry_count when an order is placed during an active giveaway
CREATE OR REPLACE FUNCTION public.add_giveaway_bonus_for_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_giveaway_id UUID;
  v_email TEXT;
BEGIN
  -- Find the active giveaway covering NOW
  SELECT id INTO v_giveaway_id
  FROM public.giveaways
  WHERE status = 'active'
    AND now() BETWEEN starts_at AND ends_at
  ORDER BY ends_at ASC
  LIMIT 1;

  IF v_giveaway_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get user email
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert entry: if exists bump bonus, else create with bonus
  INSERT INTO public.giveaway_entries (giveaway_id, user_id, user_email, entry_count, bonus_from_orders)
  VALUES (v_giveaway_id, NEW.user_id, v_email, 2, 1)
  ON CONFLICT (giveaway_id, user_id)
  DO UPDATE SET
    entry_count = public.giveaway_entries.entry_count + 1,
    bonus_from_orders = public.giveaway_entries.bonus_from_orders + 1,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Attach trigger to orders table (only if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='orders') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_giveaway_bonus_on_order ON public.orders';
    EXECUTE 'CREATE TRIGGER trg_giveaway_bonus_on_order AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.add_giveaway_bonus_for_order()';
  END IF;
END $$;

-- updated_at triggers
CREATE TRIGGER update_giveaways_updated_at
  BEFORE UPDATE ON public.giveaways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_giveaway_entries_updated_at
  BEFORE UPDATE ON public.giveaway_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();