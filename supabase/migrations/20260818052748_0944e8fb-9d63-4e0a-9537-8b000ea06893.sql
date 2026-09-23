-- Grant basic table access
GRANT SELECT, INSERT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;

-- Grant UPDATE access on specific columns to users
GRANT UPDATE (display_name, username, avatar_url, address, city, country, state, zip_code, phone) ON public.profiles TO authenticated;

-- Grant ALL access to admins (via service_role or authenticated if needed)
GRANT UPDATE ON public.profiles TO authenticated;

-- Ensure RLS is active
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Re-create the sensitive update trigger to prevent phone changes after initial set
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_self_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service role (auth.uid() IS NULL) to change anything
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow admins to change anything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Block privileged/sensitive column changes
  IF NEW.email_verified IS DISTINCT FROM OLD.email_verified
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.fake_sales_boost IS DISTINCT FROM OLD.fake_sales_boost
     OR NEW.verification_reminder_24h_sent IS DISTINCT FROM OLD.verification_reminder_24h_sent
     OR NEW.verification_reminder_48h_sent IS DISTINCT FROM OLD.verification_reminder_48h_sent
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
  THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  -- User-specific constraint: Cannot change phone number if it is already set (non-null)
  -- This allows them to set it the first time but not change it later.
  IF OLD.phone IS NOT NULL AND NEW.phone IS DISTINCT FROM OLD.phone THEN
    RAISE EXCEPTION 'Phone number cannot be changed once set. Please contact support.';
  END IF;

  RETURN NEW;
END;
$function$;
