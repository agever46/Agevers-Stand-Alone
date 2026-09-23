CREATE OR REPLACE FUNCTION public.validate_contact_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF length(btrim(NEW.name)) < 2 OR length(NEW.name) > 100 THEN
    RAISE EXCEPTION 'Invalid name length';
  END IF;
  IF length(NEW.email) > 255 OR NEW.email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;
  IF length(btrim(NEW.message)) < 10 OR length(NEW.message) > 2000 THEN
    RAISE EXCEPTION 'Invalid message length';
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.email := btrim(NEW.email);
  NEW.message := btrim(NEW.message);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_contact_message_before_insert ON public.contact_messages;
CREATE TRIGGER validate_contact_message_before_insert
BEFORE INSERT ON public.contact_messages
FOR EACH ROW EXECUTE FUNCTION public.validate_contact_message();