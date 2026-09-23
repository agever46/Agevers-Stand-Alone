CREATE POLICY "Users can reopen their own requests"
ON public.live_support_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);