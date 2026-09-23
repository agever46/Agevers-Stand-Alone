ALTER TABLE public.daily_deals ADD COLUMN IF NOT EXISTS original_price numeric NULL;
UPDATE public.daily_deals d SET original_price = k.sell_price
  FROM public.kinguin_products k
  WHERE k.allowed_product_id = d.allowed_product_id
    AND d.original_price IS NULL;