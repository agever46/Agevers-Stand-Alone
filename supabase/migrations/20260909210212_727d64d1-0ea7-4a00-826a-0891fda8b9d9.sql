DROP TRIGGER IF EXISTS trg_telegram_new_signup ON public.profiles;

CREATE OR REPLACE FUNCTION public.tg_notify_admin_new_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text := 'https://ppernxjnicippytjuxpz.supabase.co';
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := _supabase_url || '/functions/v1/notify-admin-signup',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('userId', NEW.user_id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'admin signup notification failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.tg_notify_admin_new_signup() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_admin_new_signup
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_admin_new_signup();