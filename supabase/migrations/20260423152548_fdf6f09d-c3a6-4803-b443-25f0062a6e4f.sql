-- Reclassify products incorrectly tagged as PRE ORDER BONUS when they actually
-- bundle the full base game with a pre-order bonus (title contains "+ Bonus" or
-- "+ Pre-Order Bonus", or description explicitly states the base game is included).
UPDATE allowed_products
SET product_type = 'GAME + BONUS'
WHERE product_type = 'PRE ORDER BONUS'
  AND (
    title ~* '\+\s*(pre[\s-]?order\s+)?bonus'
    OR (description ~* '(includes?|including|contains?|comes with|get(ting)?|receive|securing)[^.]{0,80}base\s+game'
        AND description ~* 'bonus')
    OR description ~* 'full\s+game\s+included'
    OR description ~* 'full\s+base\s+game'
  );