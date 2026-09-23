
-- Revoke direct RPC access to has_role from anon and authenticated
-- It will still work inside RLS policies (SECURITY DEFINER context)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated;
