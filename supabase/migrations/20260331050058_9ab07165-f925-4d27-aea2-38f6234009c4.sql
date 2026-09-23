
CREATE TABLE public.aliexpress_config (
  id integer PRIMARY KEY DEFAULT 1,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  refresh_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.aliexpress_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read aliexpress_config"
ON public.aliexpress_config FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update aliexpress_config"
ON public.aliexpress_config FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.aliexpress_config (id) VALUES (1);
