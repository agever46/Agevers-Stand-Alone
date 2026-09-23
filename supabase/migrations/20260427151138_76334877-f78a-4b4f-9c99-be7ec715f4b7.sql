ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS receipts_enabled boolean NOT NULL DEFAULT false;