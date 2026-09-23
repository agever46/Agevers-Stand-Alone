
CREATE TABLE public.brand_auto_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  target_page text NOT NULL DEFAULT 'Gift Cards',
  display_name text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_auto_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active auto groups"
ON public.brand_auto_groups FOR SELECT TO public
USING (true);

CREATE POLICY "Admins can manage auto groups"
ON public.brand_auto_groups FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed with existing hardcoded keywords
INSERT INTO public.brand_auto_groups (keyword, target_page) VALUES
  ('JUST EAT', 'Gift Cards'),
  ('GOOGLE PLAY', 'Gift Cards'),
  ('UBER', 'Gift Cards'),
  ('TOYWORLD', 'Gift Cards'),
  ('TOYS R US', 'Gift Cards'),
  ('AMAZON', 'Gift Cards'),
  ('APPLE', 'Gift Cards'),
  ('ITUNES', 'Gift Cards'),
  ('ZALANDO', 'Gift Cards'),
  ('ASOS', 'Gift Cards'),
  ('SEPHORA', 'Gift Cards'),
  ('SHEIN', 'Gift Cards'),
  ('IKEA', 'Gift Cards'),
  ('NORDSTROM', 'Gift Cards'),
  ('KOHLS', 'Gift Cards'),
  ('MACYS', 'Gift Cards'),
  ('WAYFAIR', 'Gift Cards'),
  ('GAMESTOP', 'Gift Cards'),
  ('PRIMARK', 'Gift Cards'),
  ('DELIVEROO', 'Gift Cards'),
  ('DOORDASH', 'Gift Cards'),
  ('GRUBHUB', 'Gift Cards'),
  ('INSTACART', 'Gift Cards'),
  ('STARBUCKS', 'Gift Cards'),
  ('NANDOS', 'Gift Cards'),
  ('DUNKIN', 'Gift Cards'),
  ('CHIPOTLE', 'Gift Cards'),
  ('PANERA', 'Gift Cards'),
  ('AIRBNB', 'Gift Cards'),
  ('LYFT', 'Gift Cards'),
  ('UBER EATS', 'Gift Cards'),
  ('RAZER GOLD', 'Gift Cards'),
  ('VISA', 'Gift Cards'),
  ('MASTERCARD', 'Gift Cards'),
  ('NEOSURF', 'Gift Cards'),
  ('PAYSAFECARD', 'Gift Cards'),
  ('VENMO', 'Gift Cards'),
  ('SPOTIFY', 'Gift Cards'),
  ('NETFLIX', 'Gift Cards'),
  ('HULU', 'Gift Cards'),
  ('CRUNCHYROLL', 'Gift Cards'),
  ('DEEZER', 'Gift Cards');
