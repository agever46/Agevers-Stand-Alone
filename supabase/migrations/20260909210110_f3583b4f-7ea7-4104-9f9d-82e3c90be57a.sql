CREATE OR REPLACE FUNCTION public.notify_telegram(_type text, _title text, _message text, _meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text := 'https://ppernxjnicippytjuxpz.supabase.co';
  _service_key text;
  _internal_token text;
BEGIN
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  SELECT decrypted_secret INTO _internal_token
  FROM vault.decrypted_secrets WHERE name = 'internal_notify_token' LIMIT 1;

  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-token', COALESCE(_internal_token, ''),
      'Authorization', 'Bearer ' || COALESCE(_service_key, '')
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