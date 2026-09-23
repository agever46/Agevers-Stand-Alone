
-- 1. Remove user UPDATE and INSERT policies on device_verification_codes
-- These should only be managed by the edge function via service role
DROP POLICY IF EXISTS "Users can update own verification codes" ON public.device_verification_codes;
DROP POLICY IF EXISTS "Users can insert own verification codes" ON public.device_verification_codes;

-- Add service role policies instead
CREATE POLICY "Service role can manage verification codes"
  ON public.device_verification_codes
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. Add SELECT policy for sellers on support_tickets
CREATE POLICY "Sellers can view own tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- 3. Tighten ticket-screenshots storage INSERT policy
-- Drop existing loose INSERT policy and replace with path-validated one
DROP POLICY IF EXISTS "Ticket participants can upload screenshots" ON storage.objects;
CREATE POLICY "Ticket participants can upload screenshots"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-screenshots'
    AND (
      EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id::text = (storage.foldername(name))[1]
          AND (st.buyer_id = auth.uid() OR st.seller_id = auth.uid())
      )
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );
