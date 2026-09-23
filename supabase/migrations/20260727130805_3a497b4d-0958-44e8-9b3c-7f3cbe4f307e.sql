select cron.unschedule('auto-group-gift-cards-daily');

select cron.schedule(
  'auto-group-gift-cards-daily',
  '30 3 * * *',
  $$
  select net.http_post(
    url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/auto-group-gift-cards',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);