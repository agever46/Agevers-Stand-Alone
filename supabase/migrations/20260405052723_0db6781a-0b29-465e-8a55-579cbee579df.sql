
CREATE TABLE public.delivery_proof_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  ip_address text,
  user_agent text,
  country text,
  city text,
  device_fingerprint text,
  email text,
  phone text,
  revealed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_proof_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view delivery proof logs"
  ON public.delivery_proof_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage delivery proof logs"
  ON public.delivery_proof_logs FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_delivery_proof_order ON public.delivery_proof_logs(order_id);
CREATE INDEX idx_delivery_proof_user ON public.delivery_proof_logs(user_id);
