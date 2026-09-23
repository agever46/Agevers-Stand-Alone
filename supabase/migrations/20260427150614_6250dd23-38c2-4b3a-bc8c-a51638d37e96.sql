
CREATE TABLE public.order_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  doc_no TEXT NOT NULL,
  doc_type INTEGER NOT NULL DEFAULT 400,
  pdf_original TEXT NOT NULL,
  pdf_copy TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency_code INTEGER NOT NULL DEFAULT 3,
  is_test BOOLEAN NOT NULL DEFAULT false,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_order_invoices_order_id ON public.order_invoices(order_id) WHERE is_test = false;
CREATE INDEX idx_order_invoices_created_at ON public.order_invoices(created_at DESC);

ALTER TABLE public.order_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own receipts"
ON public.order_invoices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_invoices.order_id
      AND o.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all receipts"
ON public.order_invoices
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage receipts"
ON public.order_invoices
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
