CREATE OR REPLACE FUNCTION public.get_wishlist_counts_batch(_game_titles text[])
RETURNS TABLE(game_title text, wishlist_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT w.game_title, COUNT(*) as wishlist_count
  FROM public.wishlist w
  WHERE w.game_title = ANY(_game_titles)
  GROUP BY w.game_title
$$;