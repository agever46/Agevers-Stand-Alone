-- 1. Remove public SELECT from pricing_rules (keep admin-only)
DROP POLICY IF EXISTS "Anyone can view pricing rules" ON public.pricing_rules;

-- 2. Remove public SELECT from pricing_rules_topups (keep admin-only)
DROP POLICY IF EXISTS "Anyone can view topup pricing rules" ON public.pricing_rules_topups;

-- 3. Remove public SELECT from pricing_settings (keep admin-only)
DROP POLICY IF EXISTS "Anyone can view pricing settings" ON public.pricing_settings;

-- 4. Remove "Public can view active products" from products table
DROP POLICY IF EXISTS "Public can view active products" ON public.products;

-- 5. Remove withdrawal_requests from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.withdrawal_requests;

-- 6. Fix ticket-screenshots storage: remove public SELECT, add scoped policies
DROP POLICY IF EXISTS "Anyone can view ticket screenshots" ON storage.objects;

CREATE POLICY "Ticket participants can view screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-screenshots'
    AND (
      EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.screenshot_url LIKE '%' || name
          AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
      )
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );
