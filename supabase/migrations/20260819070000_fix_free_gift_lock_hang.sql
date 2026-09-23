-- The advisory lock added for the free-gift stock cap (enforce_free_gift_stock_limit)
-- used pg_advisory_xact_lock, which BLOCKS until the lock is free. In a web
-- request context that's dangerous: if anything ever leaves that lock held
-- (a stuck/aborted connection, pooler quirk, etc.), every subsequent claim
-- for that same product hangs forever waiting for it — exactly the
-- "Verifying... nothing happens" symptom reported right after this shipped.
--
-- Switch to pg_try_advisory_xact_lock: try briefly (up to ~1s across a few
-- attempts), and if the lock is genuinely still busy, fail fast with a clear
-- error instead of hanging indefinitely. Same correctness guarantee (only
-- one claim at a time can pass the count check per product), just without
-- the unbounded-wait failure mode.
CREATE OR REPLACE FUNCTION public.enforce_free_gift_stock_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_count integer;
  v_got_lock boolean := false;
  v_attempt integer;
BEGIN
  FOR v_attempt IN 1..5 LOOP
    v_got_lock := pg_try_advisory_xact_lock(hashtext(NEW.allowed_product_id::text));
    EXIT WHEN v_got_lock;
    PERFORM pg_sleep(0.2);
  END LOOP;

  IF NOT v_got_lock THEN
    RAISE EXCEPTION 'This gift is very popular right now — please try again in a moment.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.free_gift_claims
  WHERE allowed_product_id = NEW.allowed_product_id;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'This gift is out of stock.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
