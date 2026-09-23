
-- Must re-grant: RLS policies call has_role in user context and need EXECUTE permission
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
