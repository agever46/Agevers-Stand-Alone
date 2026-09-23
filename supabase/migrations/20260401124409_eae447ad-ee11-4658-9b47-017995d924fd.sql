
-- Add shipping address fields to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_full_name text,
  ADD COLUMN IF NOT EXISTS shipping_address_line1 text,
  ADD COLUMN IF NOT EXISTS shipping_address_line2 text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_state text,
  ADD COLUMN IF NOT EXISTS shipping_zip_code text,
  ADD COLUMN IF NOT EXISTS shipping_country text,
  ADD COLUMN IF NOT EXISTS shipping_phone text;

-- Add tracking fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS carrier_name text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamp with time zone;

-- Add AliExpress order reference
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS aliexpress_order_id text;

-- Update insert policy to allow shipping address fields
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
CREATE POLICY "Users can insert their own orders"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_id)
    AND (status = 'pending')
    AND (game_code IS NULL)
    AND (is_held = false)
    AND (price > 0)
  );
