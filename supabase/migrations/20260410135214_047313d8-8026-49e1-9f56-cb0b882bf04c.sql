
-- Add email_verified to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- Create email verification tokens table
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- No public access - only edge functions via service role
CREATE POLICY "No public access to verification tokens"
  ON public.email_verification_tokens
  FOR ALL
  TO anon, authenticated
  USING (false);

-- Function to verify email token
CREATE OR REPLACE FUNCTION public.verify_email_token(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Mark token as used
  UPDATE email_verification_tokens SET used = true WHERE id = token_record.id;

  -- Mark profile as verified
  UPDATE profiles SET email_verified = true WHERE user_id = token_record.user_id;

  RETURN true;
END;
$$;
