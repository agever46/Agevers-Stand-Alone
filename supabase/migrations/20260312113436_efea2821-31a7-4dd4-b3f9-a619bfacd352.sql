ALTER TABLE public.kinguin_products 
ADD COLUMN kinguin_stock integer DEFAULT 0,
ADD COLUMN last_stock_check timestamp with time zone DEFAULT now();