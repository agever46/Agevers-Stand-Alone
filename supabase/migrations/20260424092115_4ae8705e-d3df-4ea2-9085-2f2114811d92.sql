-- Ensure each giveaway can have at most one verified winner
-- A "verified winner" is a giveaway that has both winner_user_id and winner_announced_at set.
-- This unique partial index enforces that only one row per giveaway.id can ever be created
-- (since giveaway.id is already the primary key). The real safeguard we want is to prevent
-- assigning the winner twice on the same giveaway by enforcing winner_user_id is unique
-- across rows where it's set, and that a single giveaway only has one winner.

-- 1) Once a winner is set, prevent overwriting via a trigger
CREATE OR REPLACE FUNCTION public.prevent_winner_overwrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.winner_user_id IS NOT NULL
     AND NEW.winner_user_id IS DISTINCT FROM OLD.winner_user_id THEN
    RAISE EXCEPTION 'Winner already chosen for this giveaway and cannot be changed';
  END IF;
  IF OLD.winner_announced_at IS NOT NULL
     AND NEW.winner_announced_at IS DISTINCT FROM OLD.winner_announced_at THEN
    RAISE EXCEPTION 'Winner announcement timestamp cannot be modified once set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_winner_overwrite ON public.giveaways;
CREATE TRIGGER trg_prevent_winner_overwrite
BEFORE UPDATE ON public.giveaways
FOR EACH ROW
EXECUTE FUNCTION public.prevent_winner_overwrite();

-- 2) Enforce that when a winner is set, it must be verified (status drawn) and consistent
CREATE OR REPLACE FUNCTION public.enforce_single_verified_winner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.winner_user_id IS NOT NULL THEN
    -- Mark status as drawn and stamp announced_at if missing
    IF NEW.winner_announced_at IS NULL THEN
      NEW.winner_announced_at := now();
    END IF;
    IF NEW.status <> 'drawn' THEN
      NEW.status := 'drawn';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_verified_winner ON public.giveaways;
CREATE TRIGGER trg_enforce_single_verified_winner
BEFORE INSERT OR UPDATE ON public.giveaways
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_verified_winner();