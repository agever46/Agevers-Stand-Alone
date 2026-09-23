-- The previous migration's CREATE OR REPLACE failed: Postgres won't let you
-- change a function's RETURNS TABLE shape via REPLACE, only via DROP+CREATE.
DROP FUNCTION IF EXISTS public.get_public_latest_winner();

CREATE FUNCTION public.get_public_latest_winner()
RETURNS TABLE(
  id uuid,
  title text,
  ends_at timestamptz,
  prize_image_url text,
  allowed_product_id uuid,
  winner_email text,
  winner_entry_count integer,
  winner_announced_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT g.id, g.title, g.ends_at, g.prize_image_url, g.allowed_product_id,
         g.winner_email,
         COALESCE(ge.entry_count, 0)::int AS winner_entry_count,
         g.winner_announced_at
  FROM public.giveaways g
  LEFT JOIN public.giveaway_entries ge
    ON ge.giveaway_id = g.id
   AND (
     (g.winner_user_id IS NOT NULL AND ge.user_id = g.winner_user_id)
     OR (g.winner_user_id IS NULL AND lower(ge.user_email) = lower(g.winner_email))
   )
  WHERE g.status IN ('drawn','ended')
    AND g.winner_email IS NOT NULL
  ORDER BY g.ends_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_latest_winner() TO anon, authenticated;
