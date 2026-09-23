
ALTER TABLE public.allowed_products
  ADD COLUMN IF NOT EXISTS developers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS publishers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS regional_limitations text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_details text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS release_date timestamptz DEFAULT NULL;
