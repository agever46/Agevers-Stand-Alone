ALTER TABLE public.allowed_products 
ADD COLUMN IF NOT EXISTS screenshots text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS video_url text DEFAULT NULL;