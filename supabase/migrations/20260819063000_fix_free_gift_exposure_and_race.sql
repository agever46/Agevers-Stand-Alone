-- Fix 1: free_gift_claims was readable in full by anon (raw rows, including
-- user_id and paypal_order_id, for every claim ever made) — the "Allow
-- anyone to read claim counts" policy was far broader than what any caller
-- actually needs (the frontend only ever aggregates allowed_product_id into
-- a per-product count). Replace the public row access with a SECURITY
-- DEFINER RPC that returns only the aggregate counts.
DROP POLICY IF EXISTS "Allow anyone to read claim counts" ON public.free_gift_claims;
REVOKE SELECT ON public.free_gift_claims FROM anon;

CREATE OR REPLACE FUNCTION public.get_free_gift_claim_counts()
RETURNS TABLE(allowed_product_id uuid, claim_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT allowed_product_id, count(*) AS claim_count
  FROM public.free_gift_claims
  GROUP BY allowed_product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_free_gift_claim_counts() TO anon, authenticated;

-- Fix 2: the 5-per-product stock cap was only checked in application code
-- (SELECT count, then INSERT later) — not atomic, so concurrent claims for
-- the same product could all pass the check before any of them committed,
-- overselling the free gift. Enforce it in the database with an advisory
-- lock scoped to the product, so concurrent inserts for the same product
-- serialize instead of racing. This is authoritative regardless of which
-- code path inserts into free_gift_claims.
CREATE OR REPLACE FUNCTION public.enforce_free_gift_stock_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.allowed_product_id::text));

  SELECT count(*) INTO v_count
  FROM public.free_gift_claims
  WHERE allowed_product_id = NEW.allowed_product_id;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'This gift is out of stock.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_free_gift_stock_limit ON public.free_gift_claims;
CREATE TRIGGER trg_enforce_free_gift_stock_limit
BEFORE INSERT ON public.free_gift_claims
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_gift_stock_limit();
