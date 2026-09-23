-- 1. Tinder Gold subscriptions -> Subscription
UPDATE allowed_products
SET product_type = 'Subscription'
WHERE product_type = 'Currency'
  AND COALESCE(original_title, title) ~* 'tinder\s+gold.*subscription';

-- 2. Game titles ending in ": Gold" or " Gold GOG" / " Gold Edition" / " Gold" (as part of name) -> Edition
-- These are full game editions like "Heroes of Might and Magic 2: Gold", "Company of Heroes Gold"
UPDATE allowed_products
SET product_type = 'Edition'
WHERE product_type = 'Currency'
  AND COALESCE(original_title, title) !~* '\m(coins?|gems?|v-?bucks|robux|credits?|points?|tokens?|minutes?)\M'
  AND COALESCE(original_title, title) !~* '\m\d[\d,.]*\s*(gold|cash)\M'
  AND COALESCE(original_title, title) !~* '\m(gold|cash)\s+(coins?|pack|bundle|tokens?|credits?|points?|card)\M'
  AND COALESCE(original_title, title) !~* '\mrazer\s+gold\M'
  AND COALESCE(original_title, title) !~* '\msubscription\M';

-- 3. Razer Gold gift cards stay as Currency (they are wallet credit) - leave as is.
