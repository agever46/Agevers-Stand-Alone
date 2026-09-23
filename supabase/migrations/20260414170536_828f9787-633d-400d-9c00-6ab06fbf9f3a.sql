INSERT INTO storage.buckets (id, name, public) VALUES ('section-banners', 'section-banners', true);

CREATE POLICY "Section banners are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'section-banners');

CREATE POLICY "Admins can manage section banners"
ON storage.objects FOR ALL
USING (bucket_id = 'section-banners' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'section-banners' AND public.has_role(auth.uid(), 'admin'::public.app_role));