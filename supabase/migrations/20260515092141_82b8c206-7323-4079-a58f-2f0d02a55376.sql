
CREATE TABLE public.account_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  blocked_reason TEXT,
  buyer_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  admin_comment TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_appeals_user ON public.account_appeals(user_id);
CREATE INDEX idx_account_appeals_status ON public.account_appeals(status);

ALTER TABLE public.account_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own appeals"
  ON public.account_appeals FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users create own appeals"
  ON public.account_appeals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update appeals"
  ON public.account_appeals FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_account_appeals_updated
  BEFORE UPDATE ON public.account_appeals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validation: enforce 1 open appeal + 24h cooldown after denial
CREATE OR REPLACE FUNCTION public.validate_appeal_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  open_count int;
  last_denial timestamptz;
BEGIN
  SELECT COUNT(*) INTO open_count FROM account_appeals
  WHERE user_id = NEW.user_id AND status = 'pending';
  IF open_count > 0 THEN
    RAISE EXCEPTION 'You already have a pending appeal under review';
  END IF;

  SELECT MAX(reviewed_at) INTO last_denial FROM account_appeals
  WHERE user_id = NEW.user_id AND status = 'denied';
  IF last_denial IS NOT NULL AND last_denial > now() - interval '24 hours' THEN
    RAISE EXCEPTION 'Please wait 24 hours after a denied appeal before submitting a new one';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_appeal_submission
  BEFORE INSERT ON public.account_appeals
  FOR EACH ROW EXECUTE FUNCTION public.validate_appeal_submission();

-- Telegram notification on new appeal
CREATE OR REPLACE FUNCTION public.tg_telegram_new_appeal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_telegram(
    'appeal',
    'New Purchase Block Appeal',
    LEFT(COALESCE(NEW.buyer_message, ''), 250),
    jsonb_build_object(
      'Appeal ID', NEW.id,
      'User ID', NEW.user_id,
      'Email', COALESCE(NEW.user_email, '—'),
      'Reason', COALESCE(NEW.blocked_reason, '—')
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_telegram_new_appeal
  AFTER INSERT ON public.account_appeals
  FOR EACH ROW EXECUTE FUNCTION public.tg_telegram_new_appeal();
