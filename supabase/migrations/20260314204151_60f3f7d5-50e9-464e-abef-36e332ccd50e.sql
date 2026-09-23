
CREATE TABLE public.seller_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_title TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  sale_amount NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0.10,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  net_earnings NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own sales"
  ON public.seller_sales
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY "Admins can manage all sales"
  ON public.seller_sales
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
