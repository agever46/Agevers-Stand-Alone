-- Removes the hardcoded internal-notify-token literal
-- ('agv-internal-notify-2026-Kx9pQmZ7RvT3nJ8sYbHdWfLc') from the two DB
-- trigger functions that still embed it directly in source (notify_telegram
-- and tg_admin_email_new_order). Postgres trigger functions can't read Deno
-- env vars, so — same pattern already used for the service-role key in
-- email_infra.sql ('email_queue_service_role_key') — the value moves into
-- Supabase Vault and gets looked up at call time instead of being a
-- plaintext literal committed to migration history.
--
-- This is a plain value rotation with no functional change: same token
-- value, just no longer hardcoded. Already-deployed send-transactional-email
-- and telegram-notify read the same value from their own env vars
-- (INTERNAL_NOTIFY_TOKEN / INTERNAL_NOTIFY_TOKEN_V2), so nothing needs to
-- change on that side for this to keep working.

-- 1) Store the token in Vault (safe to re-run — update if it already exists).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'internal_notify_token') THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'internal_notify_token'),
      'agv-internal-notify-2026-Kx9pQmZ7RvT3nJ8sYbHdWfLc'
    );
  ELSE
    PERFORM vault.create_secret(
      'agv-internal-notify-2026-Kx9pQmZ7RvT3nJ8sYbHdWfLc',
      'internal_notify_token',
      'Shared token DB trigger functions (pg_net) use to authenticate to send-transactional-email / telegram-notify as an internal caller.'
    );
  END IF;
END $$;

-- 2) notify_telegram() — read the token from Vault instead of a literal.
CREATE OR REPLACE FUNCTION public.notify_telegram(_type text, _title text, _message text, _meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text := 'https://ppernxjnicippytjuxpz.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXJueGpuaWNpcHB5dGp1eHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzE3MTQsImV4cCI6MjA4ODcwNzcxNH0.K8ZQ9lUfEoJ5xeFT-o710RRsyEI9KkLPBM8erXOI_dc';
  _internal_token text;
BEGIN
  SELECT decrypted_secret INTO _internal_token
  FROM vault.decrypted_secrets WHERE name = 'internal_notify_token' LIMIT 1;

  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key,
      'x-internal-token', _internal_token
    ),
    body := jsonb_build_object(
      'type', _type,
      'title', _title,
      'message', _message,
      'meta', _meta
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_telegram failed: %', SQLERRM;
END;
$function$;

-- 3) tg_admin_email_new_order() — same treatment (current definition from
--    migration 20260905165613, which fixed the boolean-expression bug —
--    only the token line changes here).
CREATE OR REPLACE FUNCTION public.tg_admin_email_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _url text := 'https://ppernxjnicippytjuxpz.supabase.co';
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXJueGpuaWNpcHB5dGp1eHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzE3MTQsImV4cCI6MjA4ODcwNzcxNH0.K8ZQ9lUfEoJ5xeFT-o710RRsyEI9KkLPBM8erXOI_dc';
  _token text;
  _buyer text;
BEGIN
  SELECT decrypted_secret INTO _token
  FROM vault.decrypted_secrets WHERE name = 'internal_notify_token' LIMIT 1;

  SELECT email INTO _buyer FROM auth.users WHERE id = NEW.user_id;

  PERFORM net.http_post(
    url := _url || '/functions/v1/send-transactional-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon,
      'x-internal-token', _token
    ),
    body := jsonb_build_object(
      'templateName', 'admin-new-order',
      'recipientEmail', 'admin@agevers.com',
      'idempotencyKey', 'admin-notify-' || NEW.id::text,
      'templateData', jsonb_build_object(
        'orderId', NEW.id::text,
        'gameTitle', COALESCE(NEW.game_title, 'Unknown product'),
        'platform', COALESCE(NEW.platform, '—'),
        'quantity', COALESCE(NEW.quantity, 1),
        'price', '€' || COALESCE(NEW.price::text, '0'),
        'buyerEmail', COALESCE(NEW.guest_email, _buyer, 'unknown'),
        'source', CASE WHEN NEW.aliexpress_order_id IS NOT NULL THEN 'aliexpress' ELSE 'store' END,
        'status', COALESCE(NEW.status, 'unknown'),
        'buyerCountry', COALESCE(NEW.buyer_country, '—')
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'tg_admin_email_new_order failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Verify:
SELECT name, created_at, updated_at FROM vault.secrets WHERE name = 'internal_notify_token';
