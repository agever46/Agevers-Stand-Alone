
CREATE TABLE public.site_settings (
  id integer PRIMARY KEY DEFAULT 1,
  maintenance_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.site_settings (id, maintenance_mode) VALUES (1, false);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read (needed to show coming soon screen)
CREATE POLICY "Anyone can read site settings"
ON public.site_settings FOR SELECT
USING (true);

-- Only admins can update
CREATE POLICY "Admins can update site settings"
ON public.site_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
