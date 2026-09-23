UPDATE allowed_products
SET product_type = 'GAME + BONUS'
WHERE (
  title ~* '\+\s*(pre[\s-]?order\s+)?bonus'
  OR original_title ~* '\+\s*(pre[\s-]?order\s+)?bonus'
  OR (
    description ~* '(includes?|including|contains?|comes with|get(ting)?|receive|securing)[^.]{0,80}base\s+game'
    AND description ~* 'bonus'
  )
)
AND (product_type IS NULL OR product_type IN ('Game', 'Edition'));