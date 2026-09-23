-- Create table for site-wide settings if it doesn't exist
CREATE TABLE IF NOT EXISTS public.free_gift_settings (
    id integer PRIMARY KEY,
    banner_enabled boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now()
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_gift_settings TO authenticated;
GRANT ALL ON public.free_gift_settings TO service_role;
GRANT SELECT ON public.free_gift_settings TO anon;

-- Enable RLS
ALTER TABLE public.free_gift_settings ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anyone to read settings') THEN
        CREATE POLICY "Allow anyone to read settings" ON public.free_gift_settings FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow admins to update settings') THEN
        CREATE POLICY "Allow admins to update settings" ON public.free_gift_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
    END IF;
END
$$;

-- Initialize the first row
INSERT INTO public.free_gift_settings (id, banner_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;
