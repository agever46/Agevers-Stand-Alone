DROP POLICY IF EXISTS "Admins can manage giveaways" ON public.giveaways;
DROP POLICY IF EXISTS "Admins can view all giveaways" ON public.giveaways;

CREATE POLICY "Super admins can manage giveaways"
ON public.giveaways
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can view all giveaways"
ON public.giveaways
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));