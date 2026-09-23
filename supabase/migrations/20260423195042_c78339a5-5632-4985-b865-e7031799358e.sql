-- Remove redundant "DLC: " prefix when title already contains DLC elsewhere
UPDATE allowed_products
SET title = REGEXP_REPLACE(title, '^DLC:\s+', '', 'i')
WHERE title ~* '^dlc:\s'
  AND title ~* '\mdlc\M.*\mdlc\M';