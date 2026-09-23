-- Tier 2 follow-up: proactive alerting for the cron-auth failure mode found
-- on 2026-08-19/20 (cron jobs silently 401ing for up to a month before
-- anyone noticed). cron-health-monitor pings the fixed functions every 30
-- min with ?healthCheckOnly=1 (auth-only, no side effects) and records the
-- outcome here; it Telegram-alerts after 2 consecutive failures, and again
-- on recovery.

CREATE TABLE public.cron_health_status (
  function_name text PRIMARY KEY,
  status text NOT NULL DEFAULT 'unknown',
  last_checked_at timestamptz,
  last_ok_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  alert_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_health_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cron health status"
  ON public.cron_health_status FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert cron health status"
  ON public.cron_health_status FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update cron health status"
  ON public.cron_health_status FOR UPDATE
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

SELECT cron.schedule(
  'cron-health-monitor-every-30-min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/cron-health-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) as request_id;
  $$
);
