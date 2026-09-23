DROP POLICY IF EXISTS "Admins can view giveaway prizes" ON public.giveaway_prizes;
DROP POLICY IF EXISTS "Admins can insert giveaway prizes" ON public.giveaway_prizes;
DROP POLICY IF EXISTS "Admins can update giveaway prizes" ON public.giveaway_prizes;

CREATE POLICY "Super admins can view giveaway prizes"
ON public.giveaway_prizes FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can insert giveaway prizes"
ON public.giveaway_prizes FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update giveaway prizes"
ON public.giveaway_prizes FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete giveaway prizes"
ON public.giveaway_prizes FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'::app_role));