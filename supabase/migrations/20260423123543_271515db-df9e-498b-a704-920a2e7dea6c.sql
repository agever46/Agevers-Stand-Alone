
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
  WITH src AS (
    SELECT
      p.id,
      p.badges,
      UPPER(p.title) AS u_title,
      UPPER(p.title || ' ' || COALESCE(p.description,'')) AS u_combo,
      p.store, p.tab_category
    FROM public.allowed_products p
  ),
  classified AS (
    SELECT
      s.id, s.badges,
      CASE
        WHEN s.u_title ~ '\+[[:space:]]*(PRE[[:space:]-]?ORDER[[:space:]]+)?BONUS\y' THEN 'GAME + BONUS'
        WHEN s.u_combo ~ '\y(INCLUDES?|INCLUDING|CONTAINS?|COMES WITH|GET|GETTING|RECEIVE|SECURING)\y[^.]{0,80}\yBASE[[:space:]]+GAME\y'
             AND s.u_combo ~ '\yBONUS\y' THEN 'GAME + BONUS'
        WHEN s.u_combo ~ '\yPRE[[:space:]-]?ORDER[[:space:]]+BONUS\y' THEN 'PRE-ORDER BONUS'
        WHEN s.store = 'Subscriptions' THEN 'Subscription'
        WHEN s.tab_category = 'topups' OR s.store = 'Top Ups' THEN 'Top Up'
        WHEN s.u_combo ~ '\ySEASON[[:space:]]+PASS\y' THEN 'Season Pass'
        WHEN s.u_combo ~ '\yEXPANSION\y' THEN 'Expansion'
        WHEN s.u_combo ~ '(\yDLC\y|\yADD[- ]?ON\y|\yCONTENT[[:space:]]+PACK\y)' THEN 'DLC'
        WHEN s.u_combo ~ '\y(SKINS?|OUTFIT|COSMETIC|CHARACTER[[:space:]]+PACK)\y' THEN 'Skin'
        WHEN s.u_combo ~ '\y(COINS?|GEMS?|V-?BUCKS|ROBUX|CREDITS?|POINTS?|GOLD|CASH|TOKENS?)\y' THEN 'Currency'
        WHEN s.u_combo ~ '\yBUNDLE\y' THEN 'Bundle'
        WHEN s.u_combo ~ '\yDIGITAL[[:space:]]+DELUXE\y' THEN 'Digital Deluxe'
        WHEN s.u_combo ~ '\ySUPER[[:space:]]+DELUXE\y' THEN 'Super Deluxe'
        WHEN s.u_combo ~ '\yDELUXE\y' THEN 'Deluxe Edition'
        WHEN s.u_combo ~ '\yGOLD[[:space:]]+EDITION\y' THEN 'Gold Edition'
        WHEN s.u_combo ~ '\yULTIMATE\y' THEN 'Ultimate Edition'
        WHEN s.u_combo ~ '\yPREMIUM\y' THEN 'Premium Edition'
        WHEN s.u_combo ~ '\yCOMPLETE\y' THEN 'Complete Edition'
        WHEN s.u_combo ~ '\yGOTY\y' THEN 'GOTY'
        WHEN s.u_combo ~ '\yDEFINITIVE\y' THEN 'Definitive Edition'
        WHEN s.u_combo ~ '\yCOLLECTOR''?S\y' THEN 'Collector''s Edition'
        WHEN s.u_combo ~ '\yLEGENDARY\y' THEN 'Legendary'
        WHEN s.u_combo ~ '\yANNIVERSARY\y' THEN 'Anniversary'
        WHEN s.u_combo ~ '\ySTANDARD[[:space:]]+EDITION\y' THEN 'Standard Edition'
        ELSE NULL
      END AS detected_label
    FROM src s
  ),
  to_update AS (
    SELECT c.id, c.detected_label
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

SELECT * FROM public.classify_and_tag_products();
