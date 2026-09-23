
-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function to notify admin of new signups
CREATE OR REPLACE FUNCTION public.notify_admin_new_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Get Supabase URL and anon key from vault or hardcoded
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- Fallback: use direct URL
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    _supabase_url := 'https://ppernxjnicippytjuxpz.supabase.co';
  END IF;
  IF _anon_key IS NULL OR _anon_key = '' THEN
    _anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXJueGpuaWNpcHB5dGp1eHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzE3MTQsImV4cCI6MjA4ODcwNzcxNH0.K8ZQ9lUfEoJ5xeFT-o710RRsyEI9KkLPBM8erXOI_dc';
  END IF;

  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/notify-admin-signup',
    body := jsonb_build_object('userId', NEW.user_id)::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    )::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block user creation if notification fails
  RAISE WARNING 'notify_admin_new_signup failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS on_profile_created_notify_admin ON public.profiles;
CREATE TRIGGER on_profile_created_notify_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_signup();
