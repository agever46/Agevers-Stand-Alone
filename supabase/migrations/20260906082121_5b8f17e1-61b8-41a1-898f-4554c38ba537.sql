REVOKE ALL ON FUNCTION public.protect_admin_notify_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_admin_notify_email() FROM anon;
REVOKE ALL ON FUNCTION public.protect_admin_notify_email() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.protect_admin_notify_email() TO service_role;