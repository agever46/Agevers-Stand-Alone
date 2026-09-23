CREATE OR REPLACE FUNCTION public.tg_notify_admin_new_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text := 'https://ppernxjnicippytjuxpz.supabase.co';
  _internal_token text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO _internal_token
    FROM vault.decrypted_secrets WHERE name = 'internal_notify_token' LIMIT 1;

    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/notify-admin-signup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-token', COALESCE(_internal_token, '')
      ),
      body := jsonb_build_object('userId', NEW.user_id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'admin signup notification failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;