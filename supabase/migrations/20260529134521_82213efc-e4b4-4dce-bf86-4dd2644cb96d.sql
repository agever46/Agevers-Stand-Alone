CREATE OR REPLACE FUNCTION public.recalculate_all_sell_prices()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Regular products (exclude anything that looks like a gift card / wallet / top up)
  UPDATE kinguin_products kp
  SET sell_price = CEIL((kp.kinguin_price * 1.0735) / (1 - pr.margin_pct) * 100) / 100,
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
      AND COALESCE(ap.store, '') NOT IN ('Top Ups', 'Gift Cards')
      AND COALESCE(ap.tab_category, '') NOT IN ('topups', 'gift-cards')
      AND ap.title NOT ILIKE '%wallet card%'
      AND ap.title NOT ILIKE '%gift card%'
      AND ap.title NOT ILIKE '%top up%'
      AND ap.title NOT ILIKE '%top-up%'
  ) pr
  WHERE kp.id = pr.id AND kp.kinguin_price IS NOT NULL;

  -- Top Ups & Gift Cards (by store, tab_category, OR title pattern)
  UPDATE kinguin_products kp
  SET sell_price = CEIL((kp.kinguin_price * 1.0735) / (1 - pr.margin_pct) * 100) / 100,
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
      AND (
        ap.store IN ('Top Ups', 'Gift Cards')
        OR ap.tab_category IN ('topups', 'gift-cards')
        OR ap.title ILIKE '%wallet card%'
        OR ap.title ILIKE '%gift card%'
        OR ap.title ILIKE '%top up%'
        OR ap.title ILIKE '%top-up%'
      )
  ) pr
  WHERE kp.id = pr.id AND kp.kinguin_price IS NOT NULL;

  PERFORM 1;
END;
$function$;

SELECT public.recalculate_all_sell_prices();