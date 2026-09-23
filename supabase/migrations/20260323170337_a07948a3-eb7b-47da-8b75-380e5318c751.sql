-- Fix country code mismatches in gift card regions and titles

-- DE -> Germany (from Europe)
UPDATE allowed_products SET region = 'Germany', title = REPLACE(title, ' - Gift Cards - Europe', ' - Gift Cards - Germany') WHERE platform = 'Gift Cards' AND title LIKE '% DE - Gift Cards - Europe';

-- FR -> France (from Europe)
UPDATE allowed_products SET region = 'France', title = REPLACE(title, ' - Gift Cards - Europe', ' - Gift Cards - France') WHERE platform = 'Gift Cards' AND title LIKE '% FR - Gift Cards - Europe';

-- IE -> Ireland (from Europe)
UPDATE allowed_products SET region = 'Ireland', title = REPLACE(title, ' - Gift Cards - Europe', ' - Gift Cards - Ireland') WHERE platform = 'Gift Cards' AND title LIKE '% IE - Gift Cards - Europe';

-- IT -> Italy (from Europe)
UPDATE allowed_products SET region = 'Italy', title = REPLACE(title, ' - Gift Cards - Europe', ' - Gift Cards - Italy') WHERE platform = 'Gift Cards' AND title LIKE '% IT - Gift Cards - Europe';

-- ES -> Spain (from Europe)
UPDATE allowed_products SET region = 'Spain', title = REPLACE(title, ' - Gift Cards - Europe', ' - Gift Cards - Spain') WHERE platform = 'Gift Cards' AND title LIKE '% ES - Gift Cards - Europe';

-- NL -> Netherlands (from Europe)
UPDATE allowed_products SET region = 'Netherlands', title = REPLACE(title, ' - Gift Cards - Europe', ' - Gift Cards - Netherlands') WHERE platform = 'Gift Cards' AND title LIKE '% NL - Gift Cards - Europe';

-- NO -> Norway (from Europe)
UPDATE allowed_products SET region = 'Norway', title = REPLACE(title, ' - Gift Cards - Europe', ' - Gift Cards - Norway') WHERE platform = 'Gift Cards' AND title LIKE '% NO - Gift Cards - Europe';

-- PL -> Poland (from Europe)
UPDATE allowed_products SET region = 'Poland', title = REPLACE(title, ' - Gift Cards - Europe', ' - Gift Cards - Poland') WHERE platform = 'Gift Cards' AND title LIKE '% PL - Gift Cards - Europe';

-- SE -> Sweden (from Europe)
UPDATE allowed_products SET region = 'Sweden', title = REPLACE(title, ' - Gift Cards - Europe', ' - Gift Cards - Sweden') WHERE platform = 'Gift Cards' AND title LIKE '% SE - Gift Cards - Europe';

-- SI -> Slovenia
UPDATE allowed_products SET region = 'Slovenia', title = regexp_replace(title, ' - Gift Cards - (Europe|Global)$', ' - Gift Cards - Slovenia') WHERE platform = 'Gift Cards' AND title LIKE '% SI - Gift Cards%' AND region IN ('Europe', 'Global');

-- SK -> Slovakia
UPDATE allowed_products SET region = 'Slovakia', title = REPLACE(title, ' - Gift Cards - Global', ' - Gift Cards - Slovakia') WHERE platform = 'Gift Cards' AND title LIKE '% SK - Gift Cards - Global';

-- CY -> Cyprus
UPDATE allowed_products SET region = 'Cyprus', title = REPLACE(title, ' - Gift Cards - Global', ' - Gift Cards - Cyprus') WHERE platform = 'Gift Cards' AND title LIKE '% CY - Gift Cards - Global';

-- LU -> Luxembourg
UPDATE allowed_products SET region = 'Luxembourg', title = regexp_replace(title, ' - Gift Cards - (Europe|Global)$', ' - Gift Cards - Luxembourg') WHERE platform = 'Gift Cards' AND title LIKE '% LU - Gift Cards%' AND region IN ('Europe', 'Global');

-- EU -> Europe
UPDATE allowed_products SET region = 'Europe', title = REPLACE(title, ' - Gift Cards - Global', ' - Gift Cards - Europe') WHERE platform = 'Gift Cards' AND title LIKE '% EU - Gift Cards - Global';

-- RU -> Russia
UPDATE allowed_products SET region = 'Russia', title = REPLACE(title, ' - Gift Cards - Global', ' - Gift Cards - Russia') WHERE platform = 'Gift Cards' AND title LIKE '% RU - Gift Cards - Global';

-- CA -> Canada (was United States)
UPDATE allowed_products SET region = 'Canada', title = REPLACE(title, ' - Gift Cards - United States', ' - Gift Cards - Canada') WHERE platform = 'Gift Cards' AND title LIKE '% CA - Gift Cards - United States';

-- MX -> Mexico (was United States)
UPDATE allowed_products SET region = 'Mexico', title = REPLACE(title, ' - Gift Cards - United States', ' - Gift Cards - Mexico') WHERE platform = 'Gift Cards' AND title LIKE '% MX - Gift Cards - United States';

-- HK -> Hong Kong (was United States)
UPDATE allowed_products SET region = 'Hong Kong', title = REPLACE(title, ' - Gift Cards - United States', ' - Gift Cards - Hong Kong') WHERE platform = 'Gift Cards' AND title LIKE '% HK - Gift Cards - United States';

-- SG -> Singapore (was United States)
UPDATE allowed_products SET region = 'Singapore', title = REPLACE(title, ' - Gift Cards - United States', ' - Gift Cards - Singapore') WHERE platform = 'Gift Cards' AND title LIKE '% SG - Gift Cards - United States';

-- NA -> North America (was United States)
UPDATE allowed_products SET region = 'North America', title = REPLACE(title, ' - Gift Cards - United States', ' - Gift Cards - North America') WHERE platform = 'Gift Cards' AND title LIKE '% NA - Gift Cards - United States';

-- US -> United States (was Russia)
UPDATE allowed_products SET region = 'United States', title = REPLACE(title, ' - Gift Cards - Russia', ' - Gift Cards - United States') WHERE platform = 'Gift Cards' AND title LIKE '% US - Gift Cards - Russia';

-- Fix iTunes/Apple cards with € and country code that got Global
UPDATE allowed_products SET region = 'Germany', title = regexp_replace(title, ' - Gift Cards - Global$', ' - Gift Cards - Germany') WHERE platform = 'Gift Cards' AND title ~ '€.* DE ' AND title LIKE '% - Gift Cards - Global';

UPDATE allowed_products SET region = 'Finland', title = regexp_replace(title, ' - Gift Cards - Global$', ' - Gift Cards - Finland') WHERE platform = 'Gift Cards' AND title ~ '€.* FI ' AND title LIKE '% - Gift Cards - Global';

UPDATE allowed_products SET region = 'France', title = regexp_replace(title, ' - Gift Cards - Global$', ' - Gift Cards - France') WHERE platform = 'Gift Cards' AND title ~ '€.* FR ' AND title LIKE '% - Gift Cards - Global';
