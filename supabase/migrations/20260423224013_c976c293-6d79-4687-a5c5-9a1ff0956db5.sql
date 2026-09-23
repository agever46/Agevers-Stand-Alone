UPDATE allowed_products
SET tab_category = 'topups'
WHERE (platform ILIKE '%playstation%' OR store ILIKE '%playstation%')
  AND (tab_category IS NULL OR tab_category = 'games')
  AND (
    UPPER(title) LIKE '%NETWORK CARD%'
    OR UPPER(title) LIKE '%PSN CARD%'
    OR UPPER(title) LIKE '%WALLET%'
    OR UPPER(title) LIKE '%TOP UP%'
    OR UPPER(title) LIKE '%TOPUP%'
    OR UPPER(title) LIKE '%PREPAID%'
    OR UPPER(title) LIKE '%GIFT CARD%'
  );