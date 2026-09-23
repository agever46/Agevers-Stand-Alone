
CREATE TABLE public.allowed_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_products ENABLE ROW LEVEL SECURITY;

-- Anyone can read the list
CREATE POLICY "Anyone can view allowed products"
  ON public.allowed_products
  FOR SELECT
  TO public
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage allowed products"
  ON public.allowed_products
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed with FALLOUT 76
INSERT INTO public.allowed_products (title) VALUES ('FALLOUT 76');
