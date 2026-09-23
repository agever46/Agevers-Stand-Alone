-- Add price tracking + restock notification fields to wishlist
ALTER TABLE public.wishlist
  ADD COLUMN IF NOT EXISTS price_at_add numeric,
  ADD COLUMN IF NOT EXISTS allowed_product_id uuid REFERENCES public.allowed_products(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS last_price_drop_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_restock_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_price_drops boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_restock boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_wishlist_allowed_product ON public.wishlist(allowed_product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON public.wishlist(user_id);

-- Backfill allowed_product_id from existing rows by matching title
UPDATE public.wishlist w
SET allowed_product_id = ap.id
FROM public.allowed_products ap
WHERE w.allowed_product_id IS NULL
  AND lower(ap.title) = lower(w.game_title);

-- Backfill price_at_add with current saved price where missing
UPDATE public.wishlist
SET price_at_add = price
WHERE price_at_add IS NULL AND price IS NOT NULL;