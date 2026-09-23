-- Supersedes the previous chat_attachments_delete policy (which also
-- allowed the original uploader to delete their own file). Per explicit
-- request, only admins/super_admins may delete chat attachments now —
-- customers can no longer delete their own uploaded files at all.
DROP POLICY IF EXISTS "chat_attachments_delete" ON storage.objects;

CREATE POLICY "chat_attachments_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-attachments' AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'super_admin')
  )
);
