
CREATE TABLE public.daily_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  allowed_product_id UUID NOT NULL REFERENCES public.allowed_products(id) ON DELETE CASCADE,
  sale_price NUMERIC NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage daily deals"
ON public.daily_deals
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active daily deals"
ON public.daily_deals
FOR SELECT
TO public
USING (is_active = true);

CREATE UNIQUE INDEX idx_daily_deals_product ON public.daily_deals(allowed_product_id);
