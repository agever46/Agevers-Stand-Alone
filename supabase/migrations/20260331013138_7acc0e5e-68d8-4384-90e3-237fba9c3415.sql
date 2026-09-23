
CREATE TABLE public.blocked_kinguin_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kinguin_product_id text NOT NULL UNIQUE,
  product_name text NOT NULL,
  blocked_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_kinguin_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage blocked kinguin products"
  ON public.blocked_kinguin_products
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
