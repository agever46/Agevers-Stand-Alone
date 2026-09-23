
-- 1. notify_admin_new_signup
ALTER FUNCTION public.notify_admin_new_signup() SET search_path = public;

-- 2. admin_list_cron_jobs
ALTER FUNCTION public.admin_list_cron_jobs() SET search_path = public, cron;

-- 3. admin_toggle_cron_job
ALTER FUNCTION public.admin_toggle_cron_job(text, boolean) SET search_path = public, cron;

-- 4. admin_update_cron_schedule
ALTER FUNCTION public.admin_update_cron_schedule(text, text) SET search_path = public, cron;

-- 5. schedule_giveaway_finalize
ALTER FUNCTION public.schedule_giveaway_finalize() SET search_path = public, cron;

-- 6. unschedule_giveaway_finalize
ALTER FUNCTION public.unschedule_giveaway_finalize() SET search_path = public, cron;
