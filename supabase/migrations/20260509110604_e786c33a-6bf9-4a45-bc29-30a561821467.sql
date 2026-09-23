DO $$
DECLARE
  v_url text;
  v_key text;
  v_resp jsonb;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key';
  v_url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/send-transactional-email';
  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'templateName', 'cooling-period-ended',
      'recipientEmail', 'bargoldinfeld@gmail.com',
      'idempotencyKey', 'cooling-ended-40aafb9c-30ae-4d4f-ab41-da9361ef06da',
      'templateData', jsonb_build_object('customerName', 'Bar')
    )
  );
END $$;