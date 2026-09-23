-- Fix products incorrectly marked as Global but locked to specific regions per Kinguin source

-- Southeast Asia (handle first - more specific)
UPDATE allowed_products
SET region = 'Southeast Asia'
WHERE region = 'Global'
  AND title ~* '\msoutheast asia\M';

-- Asia (excluding southeast asia which already handled)
UPDATE allowed_products
SET region = 'Asia',
    title = REGEXP_REPLACE(title, '(\s+-\s+)Global\s*$', '\1Asia', 'i')
WHERE region = 'Global'
  AND title ~* '\masia\M';

-- Europe (EMEA / EU)
UPDATE allowed_products
SET region = 'Europe',
    title = REGEXP_REPLACE(title, '\s+EMEA\s*$', ' - Europe', 'i')
WHERE region = 'Global'
  AND (title ~* '\memea\M' OR title ~* '\meu\M');

-- North America (Na/uk variants)
UPDATE allowed_products
SET region = 'North America'
WHERE region = 'Global'
  AND title ~* 'na/uk';