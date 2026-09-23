ALTER TABLE public.allowed_products ADD COLUMN IF NOT EXISTS wishlist_count integer NOT NULL DEFAULT 0;

UPDATE public.allowed_products SET wishlist_count = floor(random() * 300 + 20)::integer WHERE wishlist_count = 0;