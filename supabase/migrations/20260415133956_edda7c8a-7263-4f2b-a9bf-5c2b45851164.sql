-- Bundles table: manually curated product bundles with fixed discount
CREATE TABLE public.bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  discount_value NUMERIC NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bundle products: which products are in each bundle
CREATE TABLE public.bundle_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
  allowed_product_id UUID NOT NULL REFERENCES public.allowed_products(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bundle_id, allowed_product_id)
);

-- Quantity discounts: buy X items get Y% off (automatic)
CREATE TABLE public.quantity_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  min_quantity INTEGER NOT NULL,
  discount_pct NUMERIC NOT NULL, -- e.g. 0.10 for 10%
  label TEXT, -- e.g. "Buy 2, Save 10%"
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(min_quantity)
);

-- Enable RLS
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quantity_discounts ENABLE ROW LEVEL SECURITY;

-- Bundles: admins manage, anyone can view active
CREATE POLICY "Admins can manage bundles" ON public.bundles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active bundles" ON public.bundles FOR SELECT TO public
  USING (is_active = true);

-- Bundle products: admins manage, anyone can view
CREATE POLICY "Admins can manage bundle products" ON public.bundle_products FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view bundle products" ON public.bundle_products FOR SELECT TO public
  USING (true);

-- Quantity discounts: admins manage, anyone can view active
CREATE POLICY "Admins can manage quantity discounts" ON public.quantity_discounts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active quantity discounts" ON public.quantity_discounts FOR SELECT TO public
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_bundles_updated_at BEFORE UPDATE ON public.bundles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quantity_discounts_updated_at BEFORE UPDATE ON public.quantity_discounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();