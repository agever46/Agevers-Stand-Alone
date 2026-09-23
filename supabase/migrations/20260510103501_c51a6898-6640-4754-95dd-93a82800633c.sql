ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cooling_period_email_sent boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_cooling_email_pending ON public.profiles (created_at) WHERE cooling_period_email_sent = false;
-- Mark existing users older than 24h as already "sent" to avoid spamming everyone retroactively
UPDATE public.profiles SET cooling_period_email_sent = true WHERE created_at < now() - interval '24 hours';