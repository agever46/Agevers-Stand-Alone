
-- Drop the old AFTER INSERT trigger that awarded bonus on any order creation
DROP TRIGGER IF EXISTS add_giveaway_bonus_for_order_trigger ON public.orders;
DROP TRIGGER IF EXISTS trg_add_giveaway_bonus_for_order ON public.orders;
DROP TRIGGER IF EXISTS add_giveaway_bonus_trigger ON public.orders;

-- Recreate function: only award when status transitions to completed/paid/delivered
CREATE OR REPLACE FUNCTION public.add_giveaway_bonus_for_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_giveaway_id UUID;
  v_email TEXT;
  v_already_awarded BOOLEAN;
BEGIN
  -- Only fire when status becomes a "successful" state and wasn't already
  IF NEW.status NOT IN ('completed','paid','delivered') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('completed','paid','delivered') THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prevent double-award if the same order was already counted
  IF EXISTS (
    SELECT 1 FROM public.giveaway_bonus_awarded_orders WHERE order_id = NEW.id
  ) THEN
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
    RETURN NEW;
  END IF;

  INSERT INTO public.giveaway_entries (giveaway_id, user_id, user_email, entry_count, bonus_from_orders)
  VALUES (v_giveaway_id, NEW.user_id, v_email, 2, 1)
  ON CONFLICT (giveaway_id, user_id)
  DO UPDATE SET
    entry_count = public.giveaway_entries.entry_count + 1,
    bonus_from_orders = public.giveaway_entries.bonus_from_orders + 1,
    updated_at = now();

  INSERT INTO public.giveaway_bonus_awarded_orders (order_id, giveaway_id, user_id)
  VALUES (NEW.id, v_giveaway_id, NEW.user_id)
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Idempotency tracking table to prevent double-awards
CREATE TABLE IF NOT EXISTS public.giveaway_bonus_awarded_orders (
  order_id UUID PRIMARY KEY,
  giveaway_id UUID NOT NULL,
  user_id UUID NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.giveaway_bonus_awarded_orders TO authenticated;
GRANT ALL ON public.giveaway_bonus_awarded_orders TO service_role;
ALTER TABLE public.giveaway_bonus_awarded_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins view bonus awards" ON public.giveaway_bonus_awarded_orders;
CREATE POLICY "admins view bonus awards" ON public.giveaway_bonus_awarded_orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- New trigger: fires on INSERT (in case order is created already-completed) and on UPDATE of status
CREATE TRIGGER add_giveaway_bonus_for_order_trigger
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.add_giveaway_bonus_for_order();

-- Cleanup: remove the bonus entry that was wrongly awarded to the blocked user
-- (decrement only if their bonus_from_orders > 0, since the order no longer exists)
UPDATE public.giveaway_entries ge
SET entry_count = GREATEST(1, ge.entry_count - ge.bonus_from_orders),
    bonus_from_orders = 0,
    updated_at = now()
WHERE ge.bonus_from_orders > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = ge.user_id
      AND o.status IN ('completed','paid','delivered')
  );
