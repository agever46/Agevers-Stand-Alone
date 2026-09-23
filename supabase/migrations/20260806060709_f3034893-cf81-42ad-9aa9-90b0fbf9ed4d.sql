DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;

CREATE POLICY "Admins can read site settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE SELECT ON public.site_settings FROM anon;
GRANT SELECT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_site_flags()
RETURNS TABLE(maintenance_mode boolean, receipts_enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.maintenance_mode, s.receipts_enabled
  FROM public.site_settings s
  WHERE s.id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_site_flags() TO anon, authenticated;