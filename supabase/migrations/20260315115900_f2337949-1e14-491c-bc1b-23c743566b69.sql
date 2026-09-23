ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paypal_order_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS image_url text;