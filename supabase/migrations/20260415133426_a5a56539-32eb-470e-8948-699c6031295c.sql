UPDATE allowed_products
SET metadata_sync_status = 'full'
WHERE metadata_sync_status = 'partial_kinguin'
  AND (
    LOWER(store) IN ('gift cards', 'top ups', 'subscriptions', 'in-game items', 'gaming accessories', 'media & streaming')
    OR tab_category = 'topups'
  );