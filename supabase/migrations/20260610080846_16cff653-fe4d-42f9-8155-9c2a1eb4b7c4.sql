ALTER TABLE public.kinguin_products
  ADD COLUMN IF NOT EXISTS last_change_summary TEXT,
  ADD COLUMN IF NOT EXISTS last_change_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_change_source TEXT;