
-- Rate limit events table
CREATE TABLE public.rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  user_agent text,
  country text,
  user_id uuid,
  was_blocked boolean NOT NULL DEFAULT false,
  event_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rate limit events"
  ON public.rate_limit_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage rate limit events"
  ON public.rate_limit_events FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- Indexes for fast queries
CREATE INDEX idx_rate_limit_ip ON public.rate_limit_events (ip_address);
CREATE INDEX idx_rate_limit_endpoint ON public.rate_limit_events (endpoint);
CREATE INDEX idx_rate_limit_created ON public.rate_limit_events (created_at DESC);
CREATE INDEX idx_rate_limit_blocked ON public.rate_limit_events (was_blocked) WHERE was_blocked = true;

-- Cleanup function: delete events older than 30 days
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limit_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM rate_limit_events WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
