CREATE OR REPLACE FUNCTION public.add_giveaway_bonus_for_newsletter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_giveaway_id UUID;
  v_email TEXT;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_giveaway_id
  FROM public.giveaways
  WHERE status = 'active'
    AND now() BETWEEN starts_at AND ends_at
  ORDER BY ends_at ASC
  LIMIT 1;

  IF v_giveaway_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  IF v_email IS NULL THEN
    v_email := NEW.email;
  END IF;
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.giveaway_entries (giveaway_id, user_id, user_email, entry_count, bonus_from_orders)
  VALUES (v_giveaway_id, NEW.user_id, v_email, 2, 1)
  ON CONFLICT (giveaway_id, user_id)
  DO UPDATE SET
    entry_count = public.giveaway_entries.entry_count + 1,
    bonus_from_orders = public.giveaway_entries.bonus_from_orders + 1,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_newsletter_giveaway_bonus ON public.newsletter_subscribers;
CREATE TRIGGER trg_newsletter_giveaway_bonus
AFTER INSERT ON public.newsletter_subscribers
FOR EACH ROW
EXECUTE FUNCTION public.add_giveaway_bonus_for_newsletter();