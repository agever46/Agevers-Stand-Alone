
-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Allow authenticated sellers to upload images
CREATE POLICY "Sellers can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'seller'));

-- Allow anyone to view product images
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'product-images');

-- Allow sellers to delete their own uploaded images
CREATE POLICY "Sellers can delete their product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'seller'));
