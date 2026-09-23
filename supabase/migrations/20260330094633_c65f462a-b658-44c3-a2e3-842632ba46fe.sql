
-- Re-grant execute so existing code doesn't break immediately
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;

-- Create a safe wrapper that only checks the caller's own role
CREATE OR REPLACE FUNCTION public.check_my_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (role = _role OR role = 'super_admin'::app_role)
  )
$$;
