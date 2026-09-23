-- Root cause of "no email arrived" for the contact form test: the Supabase
-- gateway rejected the request with 401 UNAUTHORIZED_INVALID_JWT_FORMAT —
-- confirmed via net._http_response, timestamp-matched to the exact test
-- submission. This is NOT the internal_notify_token issue fixed earlier —
-- it's the *anon key* hardcoded in these functions ('eyJhbGci...K8ZQ9l...')
-- that the gateway no longer accepts (most likely an API key rotation at
-- some point after these functions were first written).
--
-- The already-proven-working pattern in this project (paypal-failure-watch-
-- hourly / paypal-health-check-daily cron jobs, confirmed running
-- successfully every time) uses the service-role key from Vault
-- ('email_queue_service_role_key') as the Authorization bearer instead of
-- an anon-key JWT. Switching to that here — and dropping the now-redundant
-- x-internal-token header, since a service-role Authorization already
-- fully authorizes the request in send-transactional-email's own logic
-- (`authToken !== supabaseServiceKey` short-circuits the entire auth check).

CREATE OR REPLACE FUNCTION public.notify_telegram(_type text, _title text, _message text, _meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text := 'https://ppernxjnicippytjuxpz.supabase.co';
  _service_key text;
BEGIN
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
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
  _service_key text;
  _buyer text;
BEGIN
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  SELECT email INTO _buyer FROM auth.users WHERE id = NEW.user_id;

  PERFORM net.http_post(
    url := _url || '/functions/v1/send-transactional-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
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

CREATE OR REPLACE FUNCTION public.tg_notify_admin_contact_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _url text := 'https://ppernxjnicippytjuxpz.supabase.co';
  _service_key text;
BEGIN
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  PERFORM net.http_post(
    url := _url || '/functions/v1/send-transactional-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'templateName', 'contact-form-message',
      'recipientEmail', 'admin@agevers.com',
      'idempotencyKey', 'contact-message-' || NEW.id::text,
      'templateData', jsonb_build_object(
        'name', NEW.name,
        'email', NEW.email,
        'message', NEW.message
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'tg_notify_admin_contact_message failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
