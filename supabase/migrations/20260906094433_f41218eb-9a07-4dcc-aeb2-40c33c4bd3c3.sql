CREATE TABLE public.privacy_opt_out (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid,
  source text NOT NULL DEFAULT 'footer',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX privacy_opt_out_email_key ON public.privacy_opt_out (lower(email));

GRANT INSERT ON public.privacy_opt_out TO anon;
GRANT SELECT, INSERT ON public.privacy_opt_out TO authenticated;
GRANT ALL ON public.privacy_opt_out TO service_role;

ALTER TABLE public.privacy_opt_out ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an opt-out request"
ON public.privacy_opt_out FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view opt-out requests"
ON public.privacy_opt_out FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_privacy_opt_out_updated_at
BEFORE UPDATE ON public.privacy_opt_out
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();