DROP POLICY IF EXISTS "Anyone can submit suggestions" ON public.customer_suggestions;

CREATE POLICY "Anyone can submit suggestions when site is open"
  ON public.customer_suggestions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1
      FROM public.site_settings
      WHERE id = 1
        AND maintenance_mode = true
    )
  );