
DROP FUNCTION IF EXISTS public.get_public_active_giveaway();

CREATE OR REPLACE FUNCTION public.get_public_active_giveaway()
RETURNS SETOF public.giveaways
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.giveaways
  WHERE status = 'active'
    AND ends_at > NOW()
  ORDER BY created_at DESC;
$$;
