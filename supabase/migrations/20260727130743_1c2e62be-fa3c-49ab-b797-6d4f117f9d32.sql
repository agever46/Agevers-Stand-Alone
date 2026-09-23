select cron.unschedule('auto-group-gift-cards-daily') where exists (select 1 from cron.job where jobname='auto-group-gift-cards-daily');

select cron.schedule(
  'auto-group-gift-cards-daily',
  '30 3 * * *',
  $$
  select net.http_post(
    url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/auto-group-gift-cards',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)),
    body := '{}'::jsonb
  );
  $$
);