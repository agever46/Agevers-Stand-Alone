
CREATE OR REPLACE FUNCTION public.schedule_giveaway_finalize()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  job_name TEXT;
  cron_expr TEXT;
  ends_utc TIMESTAMPTZ;
BEGIN
  job_name := 'giveaway-finalize-' || NEW.id::text;

  -- Remove any existing scheduled job for this giveaway
  PERFORM cron.unschedule(job_name)
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name);

  -- Only schedule if active/scheduled and no winner yet and ends in the future
  IF NEW.status IN ('active','scheduled')
     AND NEW.winner_user_id IS NULL
     AND NEW.ends_at > now() THEN

    ends_utc := NEW.ends_at AT TIME ZONE 'UTC';
    -- pg_cron expression: "MIN HOUR DAY MONTH *" for that exact UTC minute
    cron_expr := EXTRACT(MINUTE FROM ends_utc)::int || ' '
              || EXTRACT(HOUR   FROM ends_utc)::int || ' '
              || EXTRACT(DAY    FROM ends_utc)::int || ' '
              || EXTRACT(MONTH  FROM ends_utc)::int || ' *';

    PERFORM cron.schedule(
      job_name,
      cron_expr,
      format($cmd$
        SELECT net.http_post(
          url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/giveaway-auto-finalize',
          headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXJueGpuaWNpcHB5dGp1eHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzE3MTQsImV4cCI6MjA4ODcwNzcxNH0.K8ZQ9lUfEoJ5xeFT-o710RRsyEI9KkLPBM8erXOI_dc"}'::jsonb,
          body := '{"giveaway_id":"%s"}'::jsonb
        );
        SELECT cron.unschedule(%L);
      $cmd$, NEW.id, job_name)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_giveaway_finalize ON public.giveaways;
CREATE TRIGGER trg_schedule_giveaway_finalize
AFTER INSERT OR UPDATE OF ends_at, status, winner_user_id ON public.giveaways
FOR EACH ROW
EXECUTE FUNCTION public.schedule_giveaway_finalize();

-- Also clean up if a giveaway is deleted
CREATE OR REPLACE FUNCTION public.unschedule_giveaway_finalize()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  PERFORM cron.unschedule('giveaway-finalize-' || OLD.id::text)
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'giveaway-finalize-' || OLD.id::text);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_unschedule_giveaway_finalize ON public.giveaways;
CREATE TRIGGER trg_unschedule_giveaway_finalize
AFTER DELETE ON public.giveaways
FOR EACH ROW
EXECUTE FUNCTION public.unschedule_giveaway_finalize();
