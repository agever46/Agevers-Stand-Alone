
-- Create live chat messages table
CREATE TABLE public.live_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.live_support_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'user')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages for their own requests
CREATE POLICY "Users can read their own chat messages"
ON public.live_chat_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.live_support_requests lsr
    WHERE lsr.id = request_id AND lsr.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Users can send messages for their own requests
CREATE POLICY "Users can send messages to their own chat"
ON public.live_chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.live_support_requests lsr
      WHERE lsr.id = request_id AND lsr.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
