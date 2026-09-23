
CREATE OR REPLACE FUNCTION public.cleanup_on_allowed_product_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete matching products from sellers (matched by title, platform, store)
  DELETE FROM public.products
  WHERE LOWER(title) = LOWER(OLD.title)
    AND platform = OLD.platform
    AND store = OLD.store;

  -- Delete linked kinguin_products
  DELETE FROM public.kinguin_products
  WHERE allowed_product_id = OLD.id;

  RETURN OLD;
END;
$$;

CREATE TRIGGER on_allowed_product_delete
  BEFORE DELETE ON public.allowed_products
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_on_allowed_product_delete();
