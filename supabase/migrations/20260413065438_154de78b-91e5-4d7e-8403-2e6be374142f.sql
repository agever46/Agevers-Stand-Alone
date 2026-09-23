
-- Guide categories
CREATE TABLE public.guide_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'BookOpen',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.guide_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories"
ON public.guide_categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage categories"
ON public.guide_categories FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Guide articles
CREATE TABLE public.guide_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.guide_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  meta_title TEXT,
  meta_description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.guide_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published articles"
ON public.guide_articles FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can manage articles"
ON public.guide_articles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_guide_articles_category ON public.guide_articles(category_id);
CREATE INDEX idx_guide_articles_slug ON public.guide_articles(slug);
CREATE INDEX idx_guide_categories_slug ON public.guide_categories(slug);

-- Updated_at triggers
CREATE TRIGGER update_guide_categories_updated_at
BEFORE UPDATE ON public.guide_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guide_articles_updated_at
BEFORE UPDATE ON public.guide_articles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
