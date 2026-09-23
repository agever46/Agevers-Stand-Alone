-- 1) Pending PayPal orders staging table
CREATE TABLE IF NOT EXISTS public.pending_paypal_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paypal_order_id TEXT UNIQUE,
  user_id UUID NOT NULL,
  user_email TEXT,
  items JSONB NOT NULL,
  total_eur NUMERIC NOT NULL,
  total_charge NUMERIC NOT NULL,
  charge_currency TEXT NOT NULL DEFAULT 'EUR',
  redeem_coins INTEGER NOT NULL DEFAULT 0,
  shipping_address JSONB,
  selected_shipping JSONB,
  applied_coupon JSONB,
  status TEXT NOT NULL DEFAULT 'created', -- created | captured | fulfilled | failed
  fulfilled_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pending_paypal_orders_paypal_id_idx ON public.pending_paypal_orders(paypal_order_id);
CREATE INDEX IF NOT EXISTS pending_paypal_orders_status_idx ON public.pending_paypal_orders(status);

GRANT ALL ON public.pending_paypal_orders TO service_role;

ALTER TABLE public.pending_paypal_orders ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated access; service role bypasses RLS.
CREATE POLICY "service role only - select" ON public.pending_paypal_orders
  FOR SELECT TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.update_pending_paypal_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_update_pending_paypal_orders ON public.pending_paypal_orders;
CREATE TRIGGER trg_update_pending_paypal_orders
  BEFORE UPDATE ON public.pending_paypal_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_pending_paypal_orders_updated_at();

-- 2) Enforce uniqueness on orders.paypal_order_id (allowing nulls for non-paypal orders)
CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_order_id_unique
  ON public.orders(paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;