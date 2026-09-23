CREATE OR REPLACE FUNCTION public.get_wishlist_count(_game_title text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.wishlist
  WHERE game_title = _game_title
$$;