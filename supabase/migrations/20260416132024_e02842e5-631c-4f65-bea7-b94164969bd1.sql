
ALTER TABLE public.live_chat_messages ADD COLUMN edited boolean NOT NULL DEFAULT false;

CREATE POLICY "Users can edit their own messages"
ON public.live_chat_messages FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());
