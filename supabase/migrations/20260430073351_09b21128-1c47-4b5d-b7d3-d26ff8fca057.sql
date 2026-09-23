ALTER TABLE public.email_verification_tokens 
ADD COLUMN IF NOT EXISTS otp_code TEXT;

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_otp 
ON public.email_verification_tokens(user_id, otp_code) 
WHERE used = false;