
ALTER TABLE public.products 
ADD COLUMN price_change_alert boolean NOT NULL DEFAULT false,
ADD COLUMN low_stock_alert boolean NOT NULL DEFAULT false,
ADD COLUMN low_stock_threshold integer NOT NULL DEFAULT 3;
