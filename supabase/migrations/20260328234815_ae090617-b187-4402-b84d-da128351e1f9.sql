CREATE TABLE public.payment_processors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  fee_pct numeric NOT NULL DEFAULT 0,
  fee_fixed numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_processors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payment processors" ON public.payment_processors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active processors" ON public.payment_processors
  FOR SELECT TO public
  USING (is_active = true);

INSERT INTO public.payment_processors (name, label, fee_pct, fee_fixed, is_active, display_order)
VALUES ('paypal', 'PayPal', 3.49, 0.49, true, 1);