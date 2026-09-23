
-- Unified fraud list table for whitelist and blacklist entries
CREATE TABLE public.fraud_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_type text NOT NULL CHECK (list_type IN ('whitelist', 'blacklist')),
  entry_type text NOT NULL CHECK (entry_type IN ('email', 'ip')),
  value text NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (list_type, entry_type, value)
);

ALTER TABLE public.fraud_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fraud lists"
  ON public.fraud_lists FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can read fraud lists"
  ON public.fraud_lists FOR SELECT TO public
  USING (auth.role() = 'service_role'::text);
