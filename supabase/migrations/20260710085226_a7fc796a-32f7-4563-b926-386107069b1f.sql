
-- Drop the overly-permissive admin policy that allowed writing super_admin rows
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Admins can read all roles
CREATE POLICY "Admins can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert non-super_admin roles
CREATE POLICY "Admins can insert non-super_admin roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'super_admin'::app_role
);

-- Admins can update roles only when neither old nor new is super_admin
CREATE POLICY "Admins can update non-super_admin roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'super_admin'::app_role
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'super_admin'::app_role
);

-- Admins can delete only non-super_admin roles
CREATE POLICY "Admins can delete non-super_admin roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'super_admin'::app_role
);

-- Super admins retain full control (including managing super_admin roles)
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
