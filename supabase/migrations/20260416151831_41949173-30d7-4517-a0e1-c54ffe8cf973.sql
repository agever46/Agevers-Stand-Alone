
CREATE TABLE public.live_support_settings (
  id integer PRIMARY KEY DEFAULT 1,
  is_enabled boolean NOT NULL DEFAULT true,
  disabled_message text DEFAULT 'Live support is currently offline. Please try again later.',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.live_support_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read the setting
CREATE POLICY "Anyone can view live support settings"
ON public.live_support_settings
FOR SELECT
TO public
USING (true);

-- Only admins can update
CREATE POLICY "Admins can update live support settings"
ON public.live_support_settings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert initial row
INSERT INTO public.live_support_settings (id, is_enabled) VALUES (1, true);

-- Constraint to ensure only one row
ALTER TABLE public.live_support_settings ADD CONSTRAINT single_row CHECK (id = 1);
