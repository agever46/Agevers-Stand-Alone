
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  title text NOT NULL,
  platform text NOT NULL,
  store text NOT NULL,
  price numeric NOT NULL,
  original_price numeric,
  image_url text,
  game_code text,
  category text NOT NULL DEFAULT 'games',
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Sellers can manage their own products
CREATE POLICY "Sellers can insert their own products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller')
);

CREATE POLICY "Sellers can update their own products"
ON public.products FOR UPDATE TO authenticated
USING (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'))
WITH CHECK (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'));

CREATE POLICY "Sellers can delete their own products"
ON public.products FOR DELETE TO authenticated
USING (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'));

-- Everyone can view active products
CREATE POLICY "Anyone can view active products"
ON public.products FOR SELECT
USING (status = 'active');

-- Sellers can view all their own products
CREATE POLICY "Sellers can view all their products"
ON public.products FOR SELECT TO authenticated
USING (auth.uid() = seller_id);

-- Admins can view all products
CREATE POLICY "Admins can view all products"
ON public.products FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
