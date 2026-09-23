CREATE OR REPLACE FUNCTION public.__refresh_email_queue_key(_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE sid uuid;
BEGIN
  SELECT id INTO sid FROM vault.secrets WHERE name = 'email_queue_service_role_key';
  IF sid IS NULL THEN
    PERFORM vault.create_secret(_key, 'email_queue_service_role_key');
    RETURN 'created';
  END IF;
  PERFORM vault.update_secret(sid, _key);
  RETURN 'updated';
END;
$$;

REVOKE ALL ON FUNCTION public.__refresh_email_queue_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__refresh_email_queue_key(text) TO service_role;