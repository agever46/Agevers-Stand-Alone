
CREATE TABLE public.product_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  key_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sold_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own keys" ON public.product_keys
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert their own keys" ON public.product_keys
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid() AND has_role(auth.uid(), 'seller'::app_role));

CREATE POLICY "Sellers can update their own keys" ON public.product_keys
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() AND has_role(auth.uid(), 'seller'::app_role))
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can delete their own keys" ON public.product_keys
  FOR DELETE TO authenticated
  USING (seller_id = auth.uid() AND has_role(auth.uid(), 'seller'::app_role));

CREATE POLICY "Admins can manage all keys" ON public.product_keys
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
