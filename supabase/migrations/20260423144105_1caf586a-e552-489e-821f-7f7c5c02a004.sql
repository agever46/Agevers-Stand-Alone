-- Add product_type column to allowed_products to separate product classification from genre badges
ALTER TABLE public.allowed_products 
ADD COLUMN IF NOT EXISTS product_type TEXT;

-- Index for filtering by product type
CREATE INDEX IF NOT EXISTS idx_allowed_products_product_type ON public.allowed_products(product_type);