
-- Now revoke direct client access to has_role
-- It still works inside RLS policies (SECURITY DEFINER context)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated;
