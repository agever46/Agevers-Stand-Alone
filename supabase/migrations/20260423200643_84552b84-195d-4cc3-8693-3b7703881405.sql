-- Reclassify products misclassified as Currency due to ambiguous singular keywords
-- (POINT, GEM, COIN, CREDIT, TOKEN). Real currency titles must be plural OR have
-- numeric/pack context (e.g. "1000 Points", "Gold Pack", "V-Bucks").

UPDATE allowed_products
SET product_type = 'Game'
WHERE product_type = 'Currency'
  -- Keep if title contains explicit plural currency keywords
  AND COALESCE(original_title, title) !~* '\m(coins|gems|credits|points|tokens|v-?bucks|robux|minutes)\M'
  -- Keep if numeric prefix context (e.g. "1000 Gold", "500 Points")
  AND COALESCE(original_title, title) !~* '\m\d[\d,.]*\s*(coin|gem|credit|point|token|gold|cash)s?\M'
  -- Keep if pack/bundle context (e.g. "Gold Pack", "Coin Bundle")
  AND COALESCE(original_title, title) !~* '\m(gold|cash|coin|gem|credit|point|token)\s+(coins?|pack|bundle|tokens?|credits?|points?)\M'
  -- Keep wallet/gift card style currencies
  AND COALESCE(original_title, title) !~* '\m(razer\s+gold|gift\s+card|wallet|psn\s+card|xbox\s+card|nintendo\s+eshop|steam\s+card)\M';