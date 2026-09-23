-- Add account status tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS verification_reminder_24h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_reminder_48h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Add check constraint for valid statuses
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'suspended', 'banned'));

CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_email_verified_created ON public.profiles(email_verified, created_at) WHERE email_verified = false;

-- Function: Suspend accounts that haven't verified email after 72 hours
CREATE OR REPLACE FUNCTION public.suspend_unverified_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  suspended_count integer;
BEGIN
  UPDATE public.profiles
  SET account_status = 'suspended',
      suspended_at = now(),
      updated_at = now()
  WHERE email_verified = false
    AND account_status = 'active'
    AND created_at < now() - interval '72 hours';

  GET DIAGNOSTICS suspended_count = ROW_COUNT;
  RETURN suspended_count;
END;
$$;

-- Function: Get users that need a verification reminder (24h or 48h after signup)
CREATE OR REPLACE FUNCTION public.get_users_for_verification_reminder(_window text)
RETURNS TABLE(user_id uuid, email text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _window = '24h' THEN
    RETURN QUERY
    SELECT p.user_id, u.email::text, p.created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.email_verified = false
      AND p.account_status = 'active'
      AND p.verification_reminder_24h_sent = false
      AND p.created_at < now() - interval '24 hours'
      AND p.created_at > now() - interval '48 hours'
      AND u.email IS NOT NULL;
  ELSIF _window = '48h' THEN
    RETURN QUERY
    SELECT p.user_id, u.email::text, p.created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.email_verified = false
      AND p.account_status = 'active'
      AND p.verification_reminder_48h_sent = false
      AND p.created_at < now() - interval '48 hours'
      AND p.created_at > now() - interval '72 hours'
      AND u.email IS NOT NULL;
  END IF;
END;
$$;

-- Function to mark reminder as sent
CREATE OR REPLACE FUNCTION public.mark_verification_reminder_sent(_user_id uuid, _window text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _window = '24h' THEN
    UPDATE public.profiles SET verification_reminder_24h_sent = true, updated_at = now() WHERE user_id = _user_id;
  ELSIF _window = '48h' THEN
    UPDATE public.profiles SET verification_reminder_48h_sent = true, updated_at = now() WHERE user_id = _user_id;
  END IF;
END;
$$;

-- Reset suspended status when user verifies email (via existing verify_email_token function update)
CREATE OR REPLACE FUNCTION public.verify_email_token(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_record RECORD;
BEGIN
  SELECT * INTO token_record
  FROM email_verification_tokens
  WHERE token = _token
    AND used = false
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE email_verification_tokens SET used = true WHERE id = token_record.id;

  -- Mark verified AND reactivate suspended accounts
  UPDATE profiles
  SET email_verified = true,
      account_status = CASE WHEN account_status = 'suspended' THEN 'active' ELSE account_status END,
      suspended_at = CASE WHEN account_status = 'suspended' THEN NULL ELSE suspended_at END,
      updated_at = now()
  WHERE user_id = token_record.user_id;

  RETURN true;
END;
$$;