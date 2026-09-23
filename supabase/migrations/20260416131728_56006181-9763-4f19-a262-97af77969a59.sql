
CREATE TABLE public.live_chat_typing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.live_support_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(request_id, user_id)
);

ALTER TABLE public.live_chat_typing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read typing status for their chats"
ON public.live_chat_typing FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM live_support_requests lsr
    WHERE lsr.id = live_chat_typing.request_id AND lsr.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can upsert their own typing status"
ON public.live_chat_typing FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM live_support_requests lsr
      WHERE lsr.id = live_chat_typing.request_id AND lsr.user_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Users can update their own typing status"
ON public.live_chat_typing FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_typing;
