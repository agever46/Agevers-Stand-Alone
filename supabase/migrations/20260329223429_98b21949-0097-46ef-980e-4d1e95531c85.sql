ALTER TABLE public.allowed_products ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0;

UPDATE public.allowed_products SET sold_count = floor(random() * 900 + 100)::integer WHERE sold_count = 0;