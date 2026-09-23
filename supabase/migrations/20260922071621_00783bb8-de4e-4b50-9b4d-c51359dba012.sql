ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS maintenance_until timestamptz;

DROP FUNCTION IF EXISTS public.get_public_site_flags();

CREATE FUNCTION public.get_public_site_flags()
RETURNS TABLE(maintenance_mode boolean, receipts_enabled boolean, maintenance_until timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.maintenance_mode, s.receipts_enabled, s.maintenance_until
  FROM public.site_settings s
  WHERE s.id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_site_flags() TO anon, authenticated;