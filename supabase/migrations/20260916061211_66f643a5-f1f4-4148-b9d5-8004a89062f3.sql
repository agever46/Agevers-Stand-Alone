CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.email_verified IS DISTINCT FROM OLD.email_verified
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.fake_sales_boost IS DISTINCT FROM OLD.fake_sales_boost
     OR NEW.verification_reminder_24h_sent IS DISTINCT FROM OLD.verification_reminder_24h_sent
     OR NEW.verification_reminder_48h_sent IS DISTINCT FROM OLD.verification_reminder_48h_sent
     OR NEW.cooling_period_email_sent IS DISTINCT FROM OLD.cooling_period_email_sent
     OR NEW.cooling_period_email_attempts IS DISTINCT FROM OLD.cooling_period_email_attempts
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.referred_by_code IS DISTINCT FROM OLD.referred_by_code
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  IF OLD.phone IS NOT NULL AND NEW.phone IS DISTINCT FROM OLD.phone THEN
    RAISE EXCEPTION 'Phone number cannot be changed once set. Please contact support.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.email_verified := OLD.email_verified;
  NEW.account_status := OLD.account_status;
  NEW.suspended_at := OLD.suspended_at;
  NEW.verification_reminder_24h_sent := OLD.verification_reminder_24h_sent;
  NEW.verification_reminder_48h_sent := OLD.verification_reminder_48h_sent;
  NEW.cooling_period_email_sent := OLD.cooling_period_email_sent;
  NEW.cooling_period_email_attempts := OLD.cooling_period_email_attempts;
  NEW.fake_sales_boost := OLD.fake_sales_boost;
  NEW.referred_by_code := OLD.referred_by_code;
  NEW.user_id := OLD.user_id;
  NEW.id := OLD.id;
  NEW.created_at := OLD.created_at;

  RETURN NEW;
END;
$function$;