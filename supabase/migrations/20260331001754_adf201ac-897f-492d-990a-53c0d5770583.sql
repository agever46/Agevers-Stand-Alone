
CREATE TABLE public.brand_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_key text NOT NULL UNIQUE,
  display_name text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view brand overrides"
ON public.brand_overrides FOR SELECT TO public
USING (true);

CREATE POLICY "Admins can manage brand overrides"
ON public.brand_overrides FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
