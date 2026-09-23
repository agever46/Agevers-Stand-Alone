CREATE TABLE public.purchase_otp_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  phone text NOT NULL,
  code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '5 minutes'),
  used boolean NOT NULL DEFAULT false
);

ALTER TABLE public.purchase_otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage purchase OTP codes"
ON public.purchase_otp_codes
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Index for fast lookups
CREATE INDEX idx_purchase_otp_user_id ON public.purchase_otp_codes (user_id, used, expires_at DESC);