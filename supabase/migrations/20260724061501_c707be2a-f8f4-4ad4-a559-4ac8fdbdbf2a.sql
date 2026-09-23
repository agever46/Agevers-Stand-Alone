
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins and service role to change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Block privileged/sensitive column changes on self-update
  IF NEW.email_verified IS DISTINCT FROM OLD.email_verified
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.fake_sales_boost IS DISTINCT FROM OLD.fake_sales_boost
     OR NEW.new_account_limit_exempt IS DISTINCT FROM OLD.new_account_limit_exempt
     OR NEW.email_verification_sent_at IS DISTINCT FROM OLD.email_verification_sent_at
     OR NEW.email_verification_reminder_24h_sent_at IS DISTINCT FROM OLD.email_verification_reminder_24h_sent_at
     OR NEW.email_verification_reminder_48h_sent_at IS DISTINCT FROM OLD.email_verification_reminder_48h_sent_at
     OR NEW.email_verification_suspended_at IS DISTINCT FROM OLD.email_verification_suspended_at
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_sensitive_self_update ON public.profiles;
CREATE TRIGGER trg_prevent_profile_sensitive_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_sensitive_self_update();
