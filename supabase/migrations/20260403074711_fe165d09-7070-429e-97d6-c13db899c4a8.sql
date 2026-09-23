-- Remove duplicate cron jobs
SELECT cron.unschedule(6);
SELECT cron.unschedule(10);
