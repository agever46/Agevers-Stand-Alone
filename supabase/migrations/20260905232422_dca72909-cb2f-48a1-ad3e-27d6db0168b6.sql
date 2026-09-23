ALTER TABLE public.live_chat_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size integer;

-- storage policies for chat-attachments (path format: <request_id>/<file>)
DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_delete" ON storage.objects;

CREATE POLICY "chat_attachments_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments' AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin') OR
    EXISTS (
      SELECT 1 FROM public.live_support_requests r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.user_id = auth.uid()
    )
  )
);

CREATE POLICY "chat_attachments_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments' AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin') OR
    EXISTS (
      SELECT 1 FROM public.live_support_requests r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.user_id = auth.uid()
    )
  )
);

CREATE POLICY "chat_attachments_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments' AND owner = auth.uid()
);