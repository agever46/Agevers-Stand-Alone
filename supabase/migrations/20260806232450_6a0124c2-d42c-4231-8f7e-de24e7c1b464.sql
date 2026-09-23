
-- Use individual blocks to ensure each job is handled correctly even if others don't exist
DO $$ 
BEGIN 
    PERFORM cron.unschedule('paypal-stuck-orders-monitor');
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Skipped stuck monitor';
END $$;

DO $$ 
BEGIN 
    PERFORM cron.unschedule('process-abandoned-carts-hourly');
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Skipped abandoned carts';
END $$;

DO $$ 
BEGIN 
    PERFORM cron.unschedule('auto-group-gift-cards-daily');
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Skipped gift cards';
END $$;

DO $$ 
BEGIN 
    PERFORM cron.alter_job(jobid, schedule := '0 3 * * *') 
    FROM cron.job WHERE jobname = 'process-verification-reminders';
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Skipped verification reminders';
END $$;
