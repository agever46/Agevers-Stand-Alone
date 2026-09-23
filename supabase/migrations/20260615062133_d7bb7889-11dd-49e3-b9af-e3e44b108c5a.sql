-- 1) Public read of active kinguin_products for the storefront
CREATE POLICY "Public can view active kinguin products"
ON public.kinguin_products FOR SELECT
USING (is_active = true);

GRANT SELECT ON public.kinguin_products TO anon, authenticated;

-- 2) Tighten giveaway_entries: replace broad admin ALL policy with split policies,
--    so only super_admin can SELECT participant emails, while admins keep write ops.
DROP POLICY IF EXISTS "Admins can manage entries" ON public.giveaway_entries;

CREATE POLICY "Super admins can view all entries"
ON public.giveaway_entries FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can insert entries"
ON public.giveaway_entries FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update entries"
ON public.giveaway_entries FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete entries"
ON public.giveaway_entries FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));