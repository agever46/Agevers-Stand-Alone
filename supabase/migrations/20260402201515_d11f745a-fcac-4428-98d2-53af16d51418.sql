
CREATE TABLE public.kinguin_product_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kinguin_product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  platform TEXT,
  store TEXT,
  region TEXT DEFAULT 'Global',
  image_url TEXT,
  kinguin_price NUMERIC,
  release_date TEXT,
  category TEXT NOT NULL DEFAULT 'hot',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  metadata JSONB,
  discovered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(kinguin_product_id)
);

ALTER TABLE public.kinguin_product_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view suggestions"
ON public.kinguin_product_suggestions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update suggestions"
ON public.kinguin_product_suggestions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete suggestions"
ON public.kinguin_product_suggestions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert suggestions"
ON public.kinguin_product_suggestions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE INDEX idx_suggestions_status ON public.kinguin_product_suggestions(status);
CREATE INDEX idx_suggestions_category ON public.kinguin_product_suggestions(category);
