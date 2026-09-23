ALTER TABLE public.allowed_products ADD COLUMN IF NOT EXISTS original_title text;
-- Seed: copy current title as original for existing rows so backfill classification has data
UPDATE public.allowed_products SET original_title = title WHERE original_title IS NULL;