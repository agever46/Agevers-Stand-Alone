
-- List all cron jobs (super_admin only)
CREATE OR REPLACE FUNCTION public.admin_list_cron_jobs()
RETURNS TABLE(jobid bigint, jobname text, schedule text, command text, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
    SELECT j.jobid, j.jobname::text, j.schedule::text, j.command::text, j.active
    FROM cron.job j
    ORDER BY j.jobname;
END;
$$;

-- Update schedule of an existing cron job
CREATE OR REPLACE FUNCTION public.admin_update_cron_schedule(_jobname text, _schedule text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  _cmd text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT command INTO _cmd FROM cron.job WHERE jobname = _jobname;
  IF _cmd IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', _jobname;
  END IF;
  PERFORM cron.schedule(_jobname, _schedule, _cmd);
END;
$$;

-- Enable / disable a cron job
CREATE OR REPLACE FUNCTION public.admin_toggle_cron_job(_jobname text, _active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  PERFORM cron.alter_job(
    job_id := (SELECT jobid FROM cron.job WHERE jobname = _jobname),
    active := _active
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_cron_jobs() FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_update_cron_schedule(text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_toggle_cron_job(text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_cron_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_cron_schedule(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_cron_job(text, boolean) TO authenticated;
