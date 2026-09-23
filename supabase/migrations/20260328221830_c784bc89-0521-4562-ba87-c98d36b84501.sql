
CREATE TABLE public.trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_fingerprint)
);

CREATE TABLE public.device_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own trusted devices"
  ON public.trusted_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own trusted devices"
  ON public.trusted_devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own trusted devices"
  ON public.trusted_devices FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own trusted devices"
  ON public.trusted_devices FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can read own verification codes"
  ON public.device_verification_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own verification codes"
  ON public.device_verification_codes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own verification codes"
  ON public.device_verification_codes FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
