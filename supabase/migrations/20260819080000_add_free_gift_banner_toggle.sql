-- NOTE: this originally used a bare CREATE TABLE, which collided with the
-- earlier 20260819054110 migration that already created this table (via
-- CREATE TABLE IF NOT EXISTS) — meaning this file always errored out before
-- its INSERT below ever ran. Made idempotent so it can be replayed safely;
-- the banner_enabled=false intent below was independently applied directly
-- against the live table and confirmed already in effect.
CREATE TABLE IF NOT EXISTS public.free_gift_settings (
    id int PRIMARY KEY DEFAULT 1,
    banner_enabled boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT free_gift_settings_singleton CHECK (id = 1)
);

-- Start disabled: the claim flow currently has an open "not enough stock" bug,
-- the banner was hidden in code for this reason. Admin can re-enable once fixed.
INSERT INTO public.free_gift_settings (id, banner_enabled) VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.free_gift_settings TO anon;
GRANT SELECT, UPDATE ON public.free_gift_settings TO authenticated;
GRANT ALL ON public.free_gift_settings TO service_role;

ALTER TABLE public.free_gift_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'free_gift_settings' AND policyname = 'Anyone can view free gift settings') THEN
        CREATE POLICY "Anyone can view free gift settings" ON public.free_gift_settings
            FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'free_gift_settings' AND policyname = 'Admins manage free gift settings') THEN
        CREATE POLICY "Admins manage free gift settings" ON public.free_gift_settings
            FOR UPDATE TO authenticated
            USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
            WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
    END IF;
END
$$;
