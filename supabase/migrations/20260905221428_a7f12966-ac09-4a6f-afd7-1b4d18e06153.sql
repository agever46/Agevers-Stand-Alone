CREATE TABLE IF NOT EXISTS public.internal_secrets (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE public.internal_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.internal_secrets FROM anon, authenticated;
GRANT ALL ON public.internal_secrets TO service_role;

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
  SELECT value INTO _internal_token FROM public.internal_secrets WHERE key = 'internal_notify_token';
  IF _internal_token IS NULL THEN
    RAISE WARNING 'notify_telegram: internal token not configured';
    RETURN;
  END IF;
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

CREATE OR REPLACE FUNCTION public.tg_admin_email_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _url text := 'https://ppernxjnicippytjuxpz.supabase.co';
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXJueGpuaWNpcHB5dGp1eHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzE3MTQsImV4cCI6MjA4ODcwNzcxNH0.K8ZQ9lUfEoJ5xeFT-o710RRsyEI9KkLPBM8erXOI_dc';
  _token text;
  _buyer text;
BEGIN
  SELECT value INTO _token FROM public.internal_secrets WHERE key = 'internal_notify_token';
  IF _token IS NULL THEN
    RAISE WARNING 'tg_admin_email_new_order: internal token not configured';
    RETURN NEW;
  END IF;
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

ALTER FUNCTION public.handle_held_order_notification() SET search_path = public;
ALTER FUNCTION public.prevent_null_kinguin_stock_write() SET search_path = public;