
-- Create private storage bucket for seller verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-documents', 'seller-documents', false);

-- RLS: Users can upload their own documents
CREATE POLICY "Users can upload own seller docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'seller-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Users can view their own documents
CREATE POLICY "Users can view own seller docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'seller-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Admins can view all seller documents
CREATE POLICY "Admins can view all seller docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'seller-documents'
  AND public.has_role(auth.uid(), 'admin')
);

-- Add document columns to seller_applications
ALTER TABLE public.seller_applications
ADD COLUMN id_document_url text,
ADD COLUMN selfie_url text,
ADD COLUMN business_document_url text,
ADD COLUMN supplier_receipts_urls text[];
