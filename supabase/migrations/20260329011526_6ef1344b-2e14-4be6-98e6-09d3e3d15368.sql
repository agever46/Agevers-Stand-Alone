
-- Create pricing rules table for Top Ups & Gift Cards
CREATE TABLE public.pricing_rules_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_order integer NOT NULL DEFAULT 0,
  max_cost numeric NOT NULL,
  margin_pct numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_rules_topups ENABLE ROW LEVEL SECURITY;

-- RLS policies (same as pricing_rules)
CREATE POLICY "Admins can manage topup pricing rules"
  ON public.pricing_rules_topups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view topup pricing rules"
  ON public.pricing_rules_topups FOR SELECT TO public
  USING (true);

-- Insert default tiers (same as regular for now)
INSERT INTO public.pricing_rules_topups (tier_order, max_cost, margin_pct) VALUES
  (1, 10, 0.08),
  (2, 50, 0.06),
  (3, 150, 0.04),
  (4, 99999, 0.03);

-- Updated recalculate function that uses topup rules for Top Ups store
CREATE OR REPLACE FUNCTION public.recalculate_all_sell_prices()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Regular products (not Top Ups)
  UPDATE kinguin_products kp
  SET sell_price = CEIL(
    (kp.kinguin_price * 1.0735) / (1 - pr.margin_pct) * 100
  ) / 100,
  updated_at = now()
  FROM (
    SELECT 
      kp2.id,
      CASE
        WHEN kp2.kinguin_price * 1.0735 <= (SELECT max_cost FROM pricing_rules WHERE tier_order = 1) THEN (SELECT margin_pct FROM pricing_rules WHERE tier_order = 1)
        WHEN kp2.kinguin_price * 1.0735 <= (SELECT max_cost FROM pricing_rules WHERE tier_order = 2) THEN (SELECT margin_pct FROM pricing_rules WHERE tier_order = 2)
        WHEN kp2.kinguin_price * 1.0735 <= (SELECT max_cost FROM pricing_rules WHERE tier_order = 3) THEN (SELECT margin_pct FROM pricing_rules WHERE tier_order = 3)
        WHEN kp2.kinguin_price * 1.0735 <= (SELECT max_cost FROM pricing_rules WHERE tier_order = 4) THEN (SELECT margin_pct FROM pricing_rules WHERE tier_order = 4)
        WHEN kp2.kinguin_price * 1.0735 <= (SELECT max_cost FROM pricing_rules WHERE tier_order = 5) THEN (SELECT margin_pct FROM pricing_rules WHERE tier_order = 5)
        ELSE COALESCE((SELECT margin_pct FROM pricing_rules ORDER BY tier_order DESC LIMIT 1), 0.04)
      END as margin_pct
    FROM kinguin_products kp2
    JOIN allowed_products ap ON ap.id = kp2.allowed_product_id
    WHERE kp2.kinguin_price IS NOT NULL
      AND COALESCE(ap.store, '') != 'Top Ups'
      AND COALESCE(ap.tab_category, '') != 'topups'
  ) pr
  WHERE kp.id = pr.id
  AND kp.kinguin_price IS NOT NULL;

  -- Top Ups & Gift Cards products
  UPDATE kinguin_products kp
  SET sell_price = CEIL(
    (kp.kinguin_price * 1.0735) / (1 - pr.margin_pct) * 100
  ) / 100,
  updated_at = now()
  FROM (
    SELECT 
      kp2.id,
      CASE
        WHEN kp2.kinguin_price * 1.0735 <= (SELECT max_cost FROM pricing_rules_topups WHERE tier_order = 1) THEN (SELECT margin_pct FROM pricing_rules_topups WHERE tier_order = 1)
        WHEN kp2.kinguin_price * 1.0735 <= (SELECT max_cost FROM pricing_rules_topups WHERE tier_order = 2) THEN (SELECT margin_pct FROM pricing_rules_topups WHERE tier_order = 2)
        WHEN kp2.kinguin_price * 1.0735 <= (SELECT max_cost FROM pricing_rules_topups WHERE tier_order = 3) THEN (SELECT margin_pct FROM pricing_rules_topups WHERE tier_order = 3)
        WHEN kp2.kinguin_price * 1.0735 <= (SELECT max_cost FROM pricing_rules_topups WHERE tier_order = 4) THEN (SELECT margin_pct FROM pricing_rules_topups WHERE tier_order = 4)
        WHEN kp2.kinguin_price * 1.0735 <= (SELECT max_cost FROM pricing_rules_topups WHERE tier_order = 5) THEN (SELECT margin_pct FROM pricing_rules_topups WHERE tier_order = 5)
        ELSE COALESCE((SELECT margin_pct FROM pricing_rules_topups ORDER BY tier_order DESC LIMIT 1), 0.03)
      END as margin_pct
    FROM kinguin_products kp2
    JOIN allowed_products ap ON ap.id = kp2.allowed_product_id
    WHERE kp2.kinguin_price IS NOT NULL
      AND (ap.store = 'Top Ups' OR ap.tab_category = 'topups')
  ) pr
  WHERE kp.id = pr.id
  AND kp.kinguin_price IS NOT NULL;
END;
$function$;

-- Trigger to recalculate when topup rules change
CREATE TRIGGER recalculate_on_topup_pricing_change
  AFTER INSERT OR UPDATE OR DELETE ON public.pricing_rules_topups
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_recalculate_sell_prices();
