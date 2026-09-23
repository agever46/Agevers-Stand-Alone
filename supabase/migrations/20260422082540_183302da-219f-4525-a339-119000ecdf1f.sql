-- Schedule daily auto-generation of buying guides at 12:00 UTC
SELECT cron.schedule(
  'auto-generate-guide-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/auto-generate-guide',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object('limit', 1, 'auto_publish', true)
  ) AS request_id;
  $$
);

-- Ensure 'buying-guides' category exists
INSERT INTO public.guide_categories (name, slug, description, icon, is_active, display_order)
VALUES ('Buying Guides', 'buying-guides', 'Expert buying guides for popular games', 'ShoppingBag', true, 1)
ON CONFLICT (slug) DO NOTHING;