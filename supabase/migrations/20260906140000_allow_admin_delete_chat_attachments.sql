-- Allow admins/super_admins to delete any chat attachment file, not just
-- the original uploader. The existing "chat_attachments_delete" policy only
-- allowed `owner = auth.uid()`, which blocked admins from deleting a
-- customer-uploaded file from the new Admin > Chat Attachments page.
-- Mirrors the admin-OR-owner pattern already used by the SELECT/INSERT
-- policies on this same bucket.
DROP POLICY IF EXISTS "chat_attachments_delete" ON storage.objects;

CREATE POLICY "chat_attachments_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments' AND (
    owner = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  )
);
