-- Same root bug as kinguin-stock-sync, found on 5 more cron jobs: they send
-- only the anon apikey (sometimes as `apikey`, sometimes even as an anon-role
-- `Authorization: Bearer` token), but the target function requires a real
-- service-role token (via requireServiceOrInternal, or in the case of
-- paypal-health-check, its own inline check). All were getting 401'd and
-- silently never running. Confirmed directly against net._http_response.
--
-- kinguin-preorder-sync additionally showed a 5s pg_net timeout (separate
-- from the auth issue), so it also gets a longer timeout budget here,
-- matching the self-imposed 55s soft-timeout kinguin-stock-sync already uses
-- internally for the same kind of batch job.
--
-- cron.unschedule() (not a raw DELETE on cron.job, which the migration role
-- isn't granted) errors if the job name doesn't exist yet, so each is
-- wrapped for idempotency.

DO $$ BEGIN PERFORM cron.unschedule('kinguin-preorder-sync-every-6-hours'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'kinguin-preorder-sync-every-6-hours',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/kinguin-preorder-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) as request_id;
  $$
);

DO $$ BEGIN PERFORM cron.unschedule('process-verification-reminders'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'process-verification-reminders',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/process-verification-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

DO $$ BEGIN PERFORM cron.unschedule('process-wishlist-alerts-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'process-wishlist-alerts-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/process-wishlist-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

DO $$ BEGIN PERFORM cron.unschedule('auto-create-bundle-every-3-days'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'auto-create-bundle-every-3-days',
  '0 3 */3 * *',
  $$
  SELECT net.http_post(
    url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/auto-create-bundle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

DO $$ BEGIN PERFORM cron.unschedule('paypal-health-check-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'paypal-health-check-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/paypal-health-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
