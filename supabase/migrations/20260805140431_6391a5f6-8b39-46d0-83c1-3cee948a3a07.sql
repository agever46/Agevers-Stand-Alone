ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS proxycheck_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS abuseipdb_enabled boolean NOT NULL DEFAULT true;