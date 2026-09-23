
CREATE TABLE IF NOT EXISTS public.referral_giveaway_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  giveaway_id uuid NOT NULL REFERENCES public.giveaways(id) ON DELETE CASCADE,
  entries_awarded int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id, giveaway_id)
);

ALTER TABLE public.referral_giveaway_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view referral giveaway awards"
ON public.referral_giveaway_awards FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages referral giveaway awards"
ON public.referral_giveaway_awards FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.award_referral_giveaway_entries(
  _referrer_id uuid,
  _referred_user_id uuid,
  _entries int DEFAULT 3
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_giveaway_id uuid;
  v_email text;
BEGIN
  IF _referrer_id IS NULL OR _referred_user_id IS NULL OR _referrer_id = _referred_user_id THEN
    RETURN false;
  END IF;

  SELECT id INTO v_giveaway_id
  FROM public.giveaways
  WHERE status = 'active' AND now() BETWEEN starts_at AND ends_at
  ORDER BY ends_at ASC LIMIT 1;
  IF v_giveaway_id IS NULL THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM public.referral_giveaway_awards
    WHERE referred_user_id = _referred_user_id AND giveaway_id = v_giveaway_id
  ) THEN
    RETURN false;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = _referrer_id;
  IF v_email IS NULL THEN RETURN false; END IF;

  INSERT INTO public.giveaway_entries (giveaway_id, user_id, user_email, entry_count, bonus_from_orders)
  VALUES (v_giveaway_id, _referrer_id, v_email, _entries, 0)
  ON CONFLICT (giveaway_id, user_id) DO UPDATE
  SET entry_count = public.giveaway_entries.entry_count + _entries,
      updated_at = now();

  INSERT INTO public.referral_giveaway_awards (referrer_id, referred_user_id, giveaway_id, entries_awarded)
  VALUES (_referrer_id, _referred_user_id, v_giveaway_id, _entries);

  RETURN true;
END;
$$;
