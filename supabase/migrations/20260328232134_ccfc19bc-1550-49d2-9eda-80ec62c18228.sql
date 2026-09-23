CREATE TABLE IF NOT EXISTS public.order_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  paypal_refund_id TEXT,
  refund_type TEXT NOT NULL DEFAULT 'full',
  amount NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'completed',
  reason TEXT,
  admin_note TEXT,
  refunded_by UUID NOT NULL,
  refunded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view refunds"
ON public.order_refunds
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert refunds"
ON public.order_refunds
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_order_refunds_order_id ON public.order_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_refunded_at ON public.order_refunds(refunded_at DESC);