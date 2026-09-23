CREATE POLICY "Admins can create requests for users"
ON public.live_support_requests
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));