DROP POLICY IF EXISTS "Anyone can submit suggestions when site is open" ON public.customer_suggestions;

CREATE POLICY "Submit suggestions with matching user_id"
ON public.customer_suggestions
FOR INSERT
WITH CHECK (
  (NOT EXISTS (SELECT 1 FROM site_settings WHERE id = 1 AND maintenance_mode = true))
  AND (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  )
);