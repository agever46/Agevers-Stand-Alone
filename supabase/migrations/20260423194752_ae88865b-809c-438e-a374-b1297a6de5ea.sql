-- Restore products mistakenly mapped from EMEA to Europe back to EMEA
UPDATE allowed_products
SET region = 'EMEA',
    title = REGEXP_REPLACE(title, '\s+-\s+Europe\s*$', ' - EMEA')
WHERE original_title ~* '\memea\M'
  AND region = 'Europe';