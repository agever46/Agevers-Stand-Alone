-- News categories
CREATE TABLE public.news_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'Newspaper',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.news_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active news categories"
  ON public.news_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage news categories"
  ON public.news_categories FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- News articles
CREATE TABLE public.news_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.news_categories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  og_image_url TEXT,
  author_name TEXT NOT NULL DEFAULT 'Agever''s Editorial',
  meta_title TEXT,
  meta_description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_news_articles_published ON public.news_articles(is_published, published_at DESC);
CREATE INDEX idx_news_articles_category ON public.news_articles(category_id);
CREATE INDEX idx_news_articles_slug ON public.news_articles(slug);

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published news"
  ON public.news_articles FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage news articles"
  ON public.news_articles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Related products (manual override)
CREATE TABLE public.news_related_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  allowed_product_id UUID NOT NULL REFERENCES public.allowed_products(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (article_id, allowed_product_id)
);

CREATE INDEX idx_news_related_article ON public.news_related_products(article_id);

ALTER TABLE public.news_related_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view news related products"
  ON public.news_related_products FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage news related products"
  ON public.news_related_products FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated-at triggers
CREATE TRIGGER trg_news_categories_updated_at
  BEFORE UPDATE ON public.news_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_news_articles_updated_at
  BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto set published_at when first published
CREATE OR REPLACE FUNCTION public.set_news_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_published = true AND (OLD.is_published = false OR OLD.published_at IS NULL) AND NEW.published_at IS NULL THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_news_set_published_at
  BEFORE INSERT OR UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_news_published_at();

-- Seed categories
INSERT INTO public.news_categories (name, slug, description, icon, display_order) VALUES
  ('Game Releases', 'releases', 'New game launches and release dates', 'Rocket', 1),
  ('Deals & Discounts', 'deals', 'Best price drops and limited offers', 'Tag', 2),
  ('Updates & Patches', 'updates', 'Game updates, DLCs and patches', 'RefreshCw', 3),
  ('Industry News', 'industry', 'Gaming industry news and trends', 'Newspaper', 4),
  ('Guides & Tips', 'tips', 'Quick tips and how-to articles', 'Lightbulb', 5);