CREATE OR REPLACE FUNCTION public.notify_telegram(_type text, _title text, _message text, _meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text := 'https://ppernxjnicippytjuxpz.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXJueGpuaWNpcHB5dGp1eHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzE3MTQsImV4cCI6MjA4ODcwNzcxNH0.K8ZQ9lUfEoJ5xeFT-o710RRsyEI9KkLPBM8erXOI_dc';
  _internal_token text := 'agv-internal-notify-2026-Kx9pQmZ7RvT3nJ8sYbHdWfLc';
BEGIN
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