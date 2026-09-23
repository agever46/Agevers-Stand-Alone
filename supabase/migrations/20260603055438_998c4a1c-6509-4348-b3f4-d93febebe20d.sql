CREATE TABLE IF NOT EXISTS public.ipqs_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ipqs_cache_expires_idx ON public.ipqs_cache(expires_at);

GRANT ALL ON public.ipqs_cache TO service_role;

ALTER TABLE public.ipqs_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.ipqs_cache FOR ALL TO service_role USING (true) WITH CHECK (true);