
CREATE POLICY "Admins can view all subscribers"
  ON public.newsletter_subscribers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete subscribers"
  ON public.newsletter_subscribers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
