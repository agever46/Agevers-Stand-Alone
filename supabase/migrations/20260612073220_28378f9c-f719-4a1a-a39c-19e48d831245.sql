CREATE TABLE public.customer_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  type text NOT NULL DEFAULT 'product_request' CHECK (type IN ('product_request','bug_report','feature_request','other')),
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','accepted','rejected','done')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_suggestions TO authenticated;
GRANT INSERT ON public.customer_suggestions TO anon;
GRANT ALL ON public.customer_suggestions TO service_role;

ALTER TABLE public.customer_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit suggestions"
  ON public.customer_suggestions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users view their own suggestions"
  ON public.customer_suggestions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all suggestions"
  ON public.customer_suggestions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update suggestions"
  ON public.customer_suggestions FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete suggestions"
  ON public.customer_suggestions FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_customer_suggestions_created ON public.customer_suggestions(created_at DESC);
CREATE INDEX idx_customer_suggestions_status ON public.customer_suggestions(status);

CREATE TRIGGER update_customer_suggestions_updated_at
  BEFORE UPDATE ON public.customer_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();