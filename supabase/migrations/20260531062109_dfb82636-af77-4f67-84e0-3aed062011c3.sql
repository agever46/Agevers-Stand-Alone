DROP FUNCTION IF EXISTS public.get_public_past_winners(integer);
CREATE OR REPLACE FUNCTION public.get_public_past_winners(_limit integer DEFAULT 5)
RETURNS TABLE(id uuid, title text, prize_image_url text, allowed_product_id uuid, winner_announced_at timestamp with time zone, ends_at timestamp with time zone, winner_display text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT g.id, g.title, COALESCE(g.prize_image_url, ap.image_url) as prize_image_url, g.allowed_product_id, g.winner_announced_at, g.ends_at,
    CASE WHEN g.winner_email IS NULL THEN NULL
         ELSE LEFT(split_part(g.winner_email,'@',1), 3) || '***@' || split_part(g.winner_email,'@',2)
    END as winner_display
  FROM public.giveaways g
  LEFT JOIN public.allowed_products ap ON ap.id = g.allowed_product_id
  WHERE g.status IN ('drawn','ended') AND g.winner_email IS NOT NULL AND g.winner_announced_at IS NOT NULL
  ORDER BY g.winner_announced_at DESC NULLS LAST
  LIMIT _limit;
$function$;