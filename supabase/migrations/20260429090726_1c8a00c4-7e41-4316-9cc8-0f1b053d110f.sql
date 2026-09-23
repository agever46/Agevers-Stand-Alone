ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS email_provider TEXT NOT NULL DEFAULT 'lovable' 
CHECK (email_provider IN ('lovable', 'resend'));