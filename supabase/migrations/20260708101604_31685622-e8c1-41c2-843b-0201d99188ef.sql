CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass for service-role / internal contexts where there is no auth uid
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow admins/super_admins to modify anything
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- For non-admin users, preserve protected columns from OLD row
  NEW.email_verified := OLD.email_verified;
  NEW.account_status := OLD.account_status;
  NEW.suspended_at := OLD.suspended_at;
  NEW.verification_reminder_24h_sent := OLD.verification_reminder_24h_sent;
  NEW.verification_reminder_48h_sent := OLD.verification_reminder_48h_sent;
  NEW.user_id := OLD.user_id;

  RETURN NEW;
END;
$$;