
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins/super_admins to modify anything
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- For non-admin users, preserve protected columns from OLD row
  NEW.email_verified := OLD.email_verified;
  NEW.account_status := OLD.account_status;
  NEW.suspended_at := OLD.suspended_at;
  NEW.suspension_reason := OLD.suspension_reason;
  NEW.suspension_email_sent_at := OLD.suspension_email_sent_at;
  NEW.verification_reminder_24h_sent_at := OLD.verification_reminder_24h_sent_at;
  NEW.verification_reminder_48h_sent_at := OLD.verification_reminder_48h_sent_at;
  NEW.user_id := OLD.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
