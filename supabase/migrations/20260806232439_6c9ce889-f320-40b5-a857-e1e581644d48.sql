
DO $$ 
BEGIN 
    -- Unschedule targeted jobs
    PERFORM cron.unschedule('paypal-stuck-orders-monitor');
    PERFORM cron.unschedule('process-abandoned-carts-hourly');
    PERFORM cron.unschedule('auto-group-gift-cards-daily');
    PERFORM cron.unschedule('publish-scheduled-news-every-5min');
    PERFORM cron.unschedule('process-paraphrase-queue');

    -- Update verification reminders to Daily (03:00 UTC)
    PERFORM cron.alter_job(jobid, schedule := '0 3 * * *') 
    FROM cron.job WHERE jobname = 'process-verification-reminders';
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;
