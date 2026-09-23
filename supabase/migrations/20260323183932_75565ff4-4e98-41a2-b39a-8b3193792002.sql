
-- Collections table for grouping products visually
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  auto_group_keyword text, -- for auto-grouping by game name (e.g. "Fortnite")
  category_filter text, -- optional: limit to a store category (e.g. "In-Game Items", "Gift Cards")
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Junction table linking products to collections
CREATE TABLE public.collection_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  allowed_product_id uuid NOT NULL REFERENCES public.allowed_products(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(collection_id, allowed_product_id)
);

-- RLS
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;

-- Anyone can view active collections
CREATE POLICY "Anyone can view active collections" ON public.collections
  FOR SELECT TO public USING (is_active = true);

-- Admins can manage collections
CREATE POLICY "Admins can manage collections" ON public.collections
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view collection products
CREATE POLICY "Anyone can view collection products" ON public.collection_products
  FOR SELECT TO public USING (true);

-- Admins can manage collection products
CREATE POLICY "Admins can manage collection products" ON public.collection_products
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
