
-- Backfill: mark all users who already confirmed email in Auth as verified in profiles
UPDATE public.profiles p
SET email_verified = true, updated_at = now()
FROM auth.users u
WHERE p.user_id = u.id
  AND u.email_confirmed_at IS NOT NULL
  AND p.email_verified IS DISTINCT FROM true;

-- Trigger function to sync auth.users.email_confirmed_at -> profiles.email_verified
CREATE OR REPLACE FUNCTION public.sync_email_verified_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    UPDATE public.profiles
    SET email_verified = true, updated_at = now()
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_email_verified ON auth.users;
CREATE TRIGGER trg_sync_email_verified
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_email_verified_from_auth();
