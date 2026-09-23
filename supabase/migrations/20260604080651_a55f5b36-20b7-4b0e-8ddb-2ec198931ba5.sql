ALTER TABLE public.purchase_otp_codes ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.purchase_otp_codes ADD COLUMN IF NOT EXISTS guest_session_id TEXT;
CREATE INDEX IF NOT EXISTS purchase_otp_codes_guest_idx ON public.purchase_otp_codes(guest_session_id, used, expires_at DESC) WHERE guest_session_id IS NOT NULL;