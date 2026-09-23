CREATE TABLE public.product_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  allowed_product_id UUID NOT NULL REFERENCES public.allowed_products(id) ON DELETE CASCADE,
  sku_id TEXT NOT NULL,
  variation_name TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  price NUMERIC,
  stock INTEGER DEFAULT 0,
  sku_attr TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_variations_product ON public.product_variations(allowed_product_id);
CREATE UNIQUE INDEX idx_product_variations_sku ON public.product_variations(allowed_product_id, sku_id);

ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view variations"
ON public.product_variations
FOR SELECT
TO public
USING (true);

CREATE POLICY "Admins can manage variations"
ON public.product_variations
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));