
CREATE OR REPLACE FUNCTION public.tg_telegram_giveaway_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source text;
  v_title text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.bonus_from_orders > 0 AND NEW.entry_count > 1 THEN
      v_source := 'Newsletter signup (auto-bonus)';
    ELSE
      v_source := 'Manual join';
    END IF;
    v_title := 'New Giveaway Entry';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.entry_count = OLD.entry_count THEN
      RETURN NEW;
    END IF;
    IF NEW.bonus_from_orders > COALESCE(OLD.bonus_from_orders, 0) THEN
      v_source := 'Order bonus';
    ELSE
      v_source := 'Referral / extra entries';
    END IF;
    v_title := 'Giveaway Entries Updated';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM notify_telegram(
    'giveaway',
    v_title,
    COALESCE(NEW.user_email, 'unknown') || ' — ' || v_source,
    jsonb_build_object(
      'Giveaway ID', NEW.giveaway_id,
      'User ID', NEW.user_id,
      'Entries', NEW.entry_count,
      'Bonus from orders', NEW.bonus_from_orders,
      'Source', v_source
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'tg_telegram_giveaway_entry failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_telegram_giveaway_entry_ins ON public.giveaway_entries;
CREATE TRIGGER trg_telegram_giveaway_entry_ins
AFTER INSERT ON public.giveaway_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_telegram_giveaway_entry();

DROP TRIGGER IF EXISTS trg_telegram_giveaway_entry_upd ON public.giveaway_entries;
CREATE TRIGGER trg_telegram_giveaway_entry_upd
AFTER UPDATE ON public.giveaway_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_telegram_giveaway_entry();
