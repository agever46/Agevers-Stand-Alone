CREATE OR REPLACE FUNCTION public.get_free_gift_claim_counts()
RETURNS TABLE (allowed_product_id uuid, claim_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT allowed_product_id, count(*) as claim_count
  FROM public.free_gift_claims
  GROUP BY allowed_product_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_free_gift_claim_counts() TO anon, authenticated;
