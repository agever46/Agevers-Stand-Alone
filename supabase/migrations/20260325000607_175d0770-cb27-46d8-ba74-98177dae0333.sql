
CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_order integer NOT NULL DEFAULT 0,
  max_cost numeric NOT NULL,
  margin_pct numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pricing_settings (
  id integer PRIMARY KEY DEFAULT 1,
  fixed_fee numeric NOT NULL DEFAULT 0.50,
  platform_pct numeric NOT NULL DEFAULT 0.05,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pricing rules" ON public.pricing_rules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view pricing rules" ON public.pricing_rules FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage pricing settings" ON public.pricing_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view pricing settings" ON public.pricing_settings FOR SELECT TO public USING (true);

INSERT INTO public.pricing_settings (id, fixed_fee, platform_pct) VALUES (1, 0.50, 0.05);

INSERT INTO public.pricing_rules (tier_order, max_cost, margin_pct) VALUES
  (1, 10, 0.15),
  (2, 50, 0.10),
  (3, 150, 0.07),
  (4, 99999, 0.04);
