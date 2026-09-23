CREATE OR REPLACE FUNCTION public.set_random_social_proof()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.sold_count IS NULL OR NEW.sold_count = 0 THEN
    NEW.sold_count := floor(random() * 900 + 100)::int;
  END IF;
  IF NEW.wishlist_count IS NULL OR NEW.wishlist_count = 0 THEN
    NEW.wishlist_count := floor(random() * 300 + 20)::int;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_random_social_proof
  BEFORE INSERT ON public.allowed_products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_random_social_proof();