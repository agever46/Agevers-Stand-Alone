CREATE OR REPLACE FUNCTION public.protect_admin_notify_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'admin@agevers.com' THEN
    RAISE WARNING 'suppressed_emails: refusing to suppress admin@agevers.com (admin notify inbox is always deliverable)';
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_admin_notify_email ON public.suppressed_emails;
CREATE TRIGGER trg_protect_admin_notify_email
BEFORE INSERT OR UPDATE ON public.suppressed_emails
FOR EACH ROW EXECUTE FUNCTION public.protect_admin_notify_email();

-- Clean up any existing suppression rows for the admin inbox (should not exist)
DELETE FROM public.suppressed_emails WHERE lower(email) = 'admin@agevers.com';