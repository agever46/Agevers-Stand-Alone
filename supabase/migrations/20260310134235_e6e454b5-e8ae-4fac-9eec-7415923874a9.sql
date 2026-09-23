
CREATE POLICY "Admins can upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'::app_role));
