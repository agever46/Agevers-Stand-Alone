
CREATE OR REPLACE FUNCTION public.classify_and_tag_products()
RETURNS TABLE(label text, updated int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  type_tags text[] := ARRAY[
    'DLC','Season Pass','Expansion','Skin','Currency','Bundle','Subscription','Top Up',
    'GAME + BONUS','PRE-ORDER BONUS','Deluxe Edition','Digital Deluxe','Super Deluxe',
    'Gold Edition','Ultimate Edition','Premium Edition','Complete Edition','GOTY',
    'Definitive Edition','Collector''s Edition','Legendary','Anniversary','Standard Edition'
  ];
BEGIN
  RETURN QUERY
  WITH classified AS (
    SELECT
      p.id,
      p.badges,
      CASE
        WHEN p.title ~* '\+\s*(pre[\s-]?order\s+)?bonus\b' THEN 'GAME + BONUS'
        WHEN (UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\b(INCLUDES?|INCLUDING|CONTAINS?|COMES WITH|GET|GETTING|RECEIVE|SECURING)\b[^.]{0,80}\bBASE\s+GAME\b'
              AND UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bBONUS\b') THEN 'GAME + BONUS'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bPRE[\s-]?ORDER\s+BONUS\b' THEN 'PRE-ORDER BONUS'
        WHEN p.store = 'Subscriptions' THEN 'Subscription'
        WHEN p.tab_category = 'topups' OR p.store = 'Top Ups' THEN 'Top Up'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bSEASON\s+PASS\b' THEN 'Season Pass'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bEXPANSION\b' THEN 'Expansion'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '(\bDLC\b|\bADD[- ]?ON\b|\bCONTENT\s+PACK\b)' THEN 'DLC'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\b(SKINS?|OUTFIT|COSMETIC|CHARACTER\s+PACK)\b' THEN 'Skin'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\b(COINS?|GEMS?|V-?BUCKS|ROBUX|CREDITS?|POINTS?|GOLD|CASH|TOKENS?)\b' THEN 'Currency'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bBUNDLE\b' THEN 'Bundle'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bDIGITAL\s+DELUXE\b' THEN 'Digital Deluxe'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bSUPER\s+DELUXE\b' THEN 'Super Deluxe'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bDELUXE\b' THEN 'Deluxe Edition'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bGOLD\s+EDITION\b' THEN 'Gold Edition'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bULTIMATE\b' THEN 'Ultimate Edition'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bPREMIUM\b' THEN 'Premium Edition'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bCOMPLETE\b' THEN 'Complete Edition'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bGOTY\b' THEN 'GOTY'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bDEFINITIVE\b' THEN 'Definitive Edition'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bCOLLECTOR''?S\b' THEN 'Collector''s Edition'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bLEGENDARY\b' THEN 'Legendary'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bANNIVERSARY\b' THEN 'Anniversary'
        WHEN UPPER(p.title || ' ' || COALESCE(p.description,'')) ~ '\bSTANDARD\s+EDITION\b' THEN 'Standard Edition'
        ELSE NULL
      END AS detected_label
    FROM public.allowed_products p
  ),
  to_update AS (
    SELECT c.id, c.detected_label, c.badges
    FROM classified c
    WHERE c.detected_label IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(c.badges, ARRAY[]::text[])) b
        WHERE b = ANY(type_tags)
      )
  ),
  updated_rows AS (
    UPDATE public.allowed_products ap
    SET badges = array_prepend(tu.detected_label, COALESCE(ap.badges, ARRAY[]::text[]))
    FROM to_update tu
    WHERE ap.id = tu.id
    RETURNING tu.detected_label AS lbl
  )
  SELECT lbl::text, COUNT(*)::int
  FROM updated_rows
  GROUP BY lbl
  ORDER BY 2 DESC;
END;
$$;

-- Run it now
SELECT * FROM public.classify_and_tag_products();
