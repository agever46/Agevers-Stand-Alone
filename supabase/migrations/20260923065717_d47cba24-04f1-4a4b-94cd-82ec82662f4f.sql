ALTER TABLE public.giveaway_entries ADD COLUMN IF NOT EXISTS is_fake boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_public_past_winners(_limit integer DEFAULT 5)
RETURNS TABLE(id uuid, title text, prize_image_url text, allowed_product_id uuid, winner_announced_at timestamp with time zone, ends_at timestamp with time zone, winner_display text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT t.id, t.title, t.prize_image_url, t.allowed_product_id, t.winner_announced_at, t.ends_at,
    CASE WHEN t.winner_email IS NULL THEN NULL
         ELSE LEFT(split_part(t.winner_email,'@',1), 3) || '***@' || split_part(t.winner_email,'@',2)
    END as winner_display
  FROM (
    SELECT g.id, g.title, COALESCE(g.prize_image_url, ap.image_url) AS prize_image_url,
           g.allowed_product_id, g.winner_announced_at, g.ends_at, g.winner_email
    FROM public.giveaways g
    LEFT JOIN public.allowed_products ap ON ap.id = g.allowed_product_id
    WHERE g.status IN ('drawn','ended') AND g.winner_email IS NOT NULL AND g.winner_announced_at IS NOT NULL
    UNION ALL
    SELECT g.id, g.title, COALESCE(g.prize_image_url, ap.image_url) AS prize_image_url,
           g.allowed_product_id, gp.created_at AS winner_announced_at, g.ends_at, gp.winner_email
    FROM public.giveaway_prizes gp
    JOIN public.giveaways g ON g.id = gp.giveaway_id
    LEFT JOIN public.allowed_products ap ON ap.id = g.allowed_product_id
    WHERE g.status IN ('drawn','ended')
      AND gp.winner_email IS NOT NULL
      AND gp.winner_email <> COALESCE(g.winner_email, '')
  ) t
  ORDER BY t.winner_announced_at DESC NULLS LAST
  LIMIT _limit;
$function$;