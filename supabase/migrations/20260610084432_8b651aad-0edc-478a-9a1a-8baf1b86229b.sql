SELECT cron.unschedule('kinguin-stock-sync-every-2min');

SELECT cron.schedule(
  'kinguin-stock-sync-every-5-hours',
  '0 */5 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://ppernxjnicippytjuxpz.supabase.co/functions/v1/kinguin-stock-sync',
        headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXJueGpuaWNpcHB5dGp1eHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzE3MTQsImV4cCI6MjA4ODcwNzcxNH0.K8ZQ9lUfEoJ5xeFT-o710RRsyEI9KkLPBM8erXOI_dc"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);