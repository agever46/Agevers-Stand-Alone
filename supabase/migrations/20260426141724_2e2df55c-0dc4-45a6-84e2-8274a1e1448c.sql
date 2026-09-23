ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pending_kinguin jsonb;

COMMENT ON COLUMN public.orders.pending_kinguin IS
  'Deferred Kinguin purchase metadata. When set, the order has not yet purchased keys from Kinguin; the purchase happens when the user clicks Reveal Code. Shape: { kinguin_product_id, qty, expected_price }';