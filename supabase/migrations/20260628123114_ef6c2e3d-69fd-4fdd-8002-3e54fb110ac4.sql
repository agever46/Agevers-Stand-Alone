-- Restrict anonymous SELECT on kinguin_products to non-sensitive columns only.
-- Sensitive columns (kinguin_price, last_change_summary, last_change_at,
-- last_change_source, last_webhook_update, last_stock_check, is_overpriced,
-- kinguin_product_id, region) remain readable to authenticated/admin/service roles.
REVOKE SELECT ON public.kinguin_products FROM anon;
GRANT SELECT (id, allowed_product_id, sell_price, kinguin_stock, is_active)
  ON public.kinguin_products TO anon;