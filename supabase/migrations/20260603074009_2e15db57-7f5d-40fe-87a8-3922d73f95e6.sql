ALTER TABLE public.kinguin_products
ADD COLUMN IF NOT EXISTS is_overpriced boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS overpriced_marked_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_kinguin_products_overpriced
ON public.kinguin_products(is_overpriced) WHERE is_overpriced = true;