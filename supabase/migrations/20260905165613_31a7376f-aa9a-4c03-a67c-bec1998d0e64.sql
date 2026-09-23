-- 1) Allow multi-item carts: one orders row per item shares a paypal_order_id.
DROP INDEX IF EXISTS public.orders_paypal_order_id_unique;

CREATE INDEX IF NOT EXISTS orders_paypal_order_id_idx
  ON public.orders (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

-- Still block double-fulfillment of the same item for the same payment
-- (protects against the concurrent client + webhook race).
CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_order_item_unique
  ON public.orders (paypal_order_id, game_title, platform)
  WHERE paypal_order_id IS NOT NULL;

-- 2) Fix the admin new-order email trigger (invalid boolean expression).
CREATE OR REPLACE FUNCTION public.tg_admin_email_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _url text := 'https://ppernxjnicippytjuxpz.supabase.co';
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXJueGpuaWNpcHB5dGp1eHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzE3MTQsImV4cCI6MjA4ODcwNzcxNH0.K8ZQ9lUfEoJ5xeFT-o710RRsyEI9KkLPBM8erXOI_dc';
  _token text := 'agv-internal-notify-2026-Kx9pQmZ7RvT3nJ8sYbHdWfLc';
  _buyer text;
BEGIN
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