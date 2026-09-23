
-- Fraud scores table - tracks cumulative risk per user
CREATE TABLE public.fraud_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  risk_score integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low',
  is_blocked boolean NOT NULL DEFAULT false,
  total_flags integer NOT NULL DEFAULT 0,
  total_purchases integer NOT NULL DEFAULT 0,
  total_chargebacks integer NOT NULL DEFAULT 0,
  last_purchase_at timestamptz,
  last_flag_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Fraud flags table - individual suspicious events
CREATE TABLE public.fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flag_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fraud_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

-- Only admins and service role can access fraud tables
CREATE POLICY "Admins can manage fraud scores" ON public.fraud_scores
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage fraud scores" ON public.fraud_scores
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can manage fraud flags" ON public.fraud_flags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage fraud flags" ON public.fraud_flags
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
