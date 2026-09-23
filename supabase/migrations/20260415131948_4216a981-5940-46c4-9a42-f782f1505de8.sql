
CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type text NOT NULL, -- create, update, delete
  entity_type text NOT NULL, -- product, order, pricing, collection, user, etc.
  entity_id text, -- the ID of the affected entity
  entity_title text, -- human-readable title
  changes jsonb DEFAULT '{}'::jsonb, -- { before: {...}, after: {...} }
  performed_by uuid NOT NULL, -- admin user_id
  performer_email text, -- cached for display
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_entity_type ON public.admin_audit_log(entity_type);
CREATE INDEX idx_audit_log_performed_by ON public.admin_audit_log(performed_by);

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view
CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert (from edge functions and triggers)
CREATE POLICY "Service role can insert audit log"
  ON public.admin_audit_log FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role'::text);

-- Admins can insert audit log entries from client
CREATE POLICY "Admins can insert audit log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
