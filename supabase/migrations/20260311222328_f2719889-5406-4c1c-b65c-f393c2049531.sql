
-- Table to link allowed_products to Kinguin product IDs
CREATE TABLE public.kinguin_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allowed_product_id uuid NOT NULL REFERENCES public.allowed_products(id) ON DELETE CASCADE,
  kinguin_product_id text NOT NULL,
  kinguin_price numeric,
  sell_price numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(allowed_product_id)
);

-- Enable RLS
ALTER TABLE public.kinguin_products ENABLE ROW LEVEL SECURITY;

-- Admins can manage kinguin products
CREATE POLICY "Admins can manage kinguin products"
  ON public.kinguin_products
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anyone can view active kinguin products
CREATE POLICY "Anyone can view active kinguin products"
  ON public.kinguin_products
  FOR SELECT
  TO public
  USING (is_active = true);

-- Table to log kinguin purchases
CREATE TABLE public.kinguin_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kinguin_order_id text NOT NULL,
  kinguin_product_id text NOT NULL,
  kinguin_price numeric NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  game_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kinguin_orders ENABLE ROW LEVEL SECURITY;

-- Only admins can view kinguin orders
CREATE POLICY "Admins can manage kinguin orders"
  ON public.kinguin_orders
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
