ALTER TABLE public.pending_paypal_orders
  ADD COLUMN IF NOT EXISTS payment_source_type text,
  ADD COLUMN IF NOT EXISTS payment_source_detail text;