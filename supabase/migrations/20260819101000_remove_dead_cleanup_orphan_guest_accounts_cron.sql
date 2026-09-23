-- cleanup-orphan-guest-accounts has no source in this repo (deleted at some
-- point without cleaning up its schedule) and has been failing with
-- 404 NOT_FOUND_FUNCTION_BLOB every day at 3:30 AM. Removing the dead job.
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-orphan-guest-accounts-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
