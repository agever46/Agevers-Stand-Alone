-- The kinguin-stock-sync cron job has been calling the edge function with only
-- an `apikey` header (anon key), never an `Authorization: Bearer <token>`.
-- The function's requireServiceOrInternal() check requires the service-role
-- key (or x-internal-token) in Authorization, so every invocation has been
-- returning 401 Unauthorized — meaning stock sync silently stopped running
-- entirely. Products that flip out of stock (real or transient) can never
-- recover automatically as a result.
--
-- Fix: reschedule using the same vault-backed service-role-key pattern
-- already used elsewhere in this project. cron.unschedule() (not a raw
-- DELETE on cron.job, which the migration role isn't granted) errors if the
-- job name doesn't exist yet, so it's wrapped for idempotency.
DO $$
BEGIN
  PERFORM cron.unschedule('kinguin-stock-sync-every-5-hours');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'kinguin-stock-sync-every-5-hours',
  '0 */5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/kinguin-stock-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
