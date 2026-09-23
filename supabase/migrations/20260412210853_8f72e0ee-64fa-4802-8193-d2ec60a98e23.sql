CREATE POLICY "Admins can delete search logs"
ON public.search_logs
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
);