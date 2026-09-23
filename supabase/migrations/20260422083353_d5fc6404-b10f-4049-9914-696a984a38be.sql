-- Create public bucket for AI-generated article images (news + guides)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('article-images', 'article-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Public can view article images"
ON storage.objects FOR SELECT
USING (bucket_id = 'article-images');

-- Admins can upload
CREATE POLICY "Admins can upload article images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'article-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Admins can update
CREATE POLICY "Admins can update article images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'article-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete
CREATE POLICY "Admins can delete article images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'article-images' AND has_role(auth.uid(), 'admin'::app_role));