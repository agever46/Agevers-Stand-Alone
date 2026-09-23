
CREATE OR REPLACE FUNCTION public.recalculate_all_sell_prices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
    WHERE kp2.kinguin_price IS NOT NULL
  ) pr
  WHERE kp.id = pr.id
  AND kp.kinguin_price IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_sell_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM recalculate_all_sell_prices();
  RETURN NEW;
END;
$$;

CREATE TRIGGER recalc_prices_on_rule_change
AFTER INSERT OR UPDATE OR DELETE ON pricing_rules
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_recalculate_sell_prices();
