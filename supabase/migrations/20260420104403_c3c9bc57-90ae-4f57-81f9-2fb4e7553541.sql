UPDATE game_group_items ggi
SET item_type = CASE
  WHEN ap.title ~* '\m(DLC|Pack|Bonus|Season Pass|Expansion|Kit)\M' THEN 'dlc'::game_item_type
  WHEN ap.title ~* '\mSkin\M' THEN 'skin'::game_item_type
  WHEN ap.title ~* '\m(coins?|gems?|v-?bucks|robux|credits?)\M' THEN 'currency'::game_item_type
  WHEN ap.title ~* '\m(Deluxe|Gold|Ultimate|Premium|Collector)\M' THEN 'edition'::game_item_type
  ELSE 'base'::game_item_type
END
FROM allowed_products ap, game_groups gg
WHERE ggi.allowed_product_id = ap.id
  AND ggi.group_id = gg.id
  AND gg.slug = 'resident-evil-requiem';