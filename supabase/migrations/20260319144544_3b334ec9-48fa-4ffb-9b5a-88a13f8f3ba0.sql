
CREATE TABLE public.bot_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  action_description text NOT NULL,
  input_data jsonb DEFAULT '{}'::jsonb,
  output_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  conversation_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bot logs"
ON public.bot_action_logs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage bot logs"
ON public.bot_action_logs
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_bot_action_logs_created ON public.bot_action_logs(created_at DESC);
CREATE INDEX idx_bot_action_logs_conversation ON public.bot_action_logs(conversation_id);
