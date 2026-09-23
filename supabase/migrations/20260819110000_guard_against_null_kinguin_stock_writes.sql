-- Temporary DB-level safety net while fulfill-order's fix (removing a buggy
-- write that always set kinguin_stock=null, is_active=false on every
-- deferred Kinguin purchase) is waiting to be redeployed. Every legitimate
-- writer (webhook, cron, reveal-and-fulfill, kinguin-purchase) always writes
-- a real number via a `?? 0` fallback, never a literal NULL — so this only
-- intercepts the exact buggy write pattern and leaves everything else alone.
-- Safe to remove once fulfill-order is confirmed redeployed.
CREATE OR REPLACE FUNCTION public.prevent_null_kinguin_stock_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kinguin_stock IS NULL AND OLD.kinguin_stock IS NOT NULL THEN
    NEW.kinguin_stock := OLD.kinguin_stock;
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_null_kinguin_stock_write_trigger ON public.kinguin_products;
CREATE TRIGGER prevent_null_kinguin_stock_write_trigger
BEFORE UPDATE ON public.kinguin_products
FOR EACH ROW
EXECUTE FUNCTION public.prevent_null_kinguin_stock_write();
