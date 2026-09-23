CREATE OR REPLACE FUNCTION public.get_public_past_winners(_limit integer DEFAULT 5)
 RETURNS TABLE(id uuid, title text, prize_image_url text, winner_announced_at timestamp with time zone, ends_at timestamp with time zone, winner_display text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, title, prize_image_url, winner_announced_at, ends_at,
    CASE
      WHEN winner_email IS NULL THEN NULL
      ELSE LEFT(split_part(winner_email,'@',1), 3) || '***@' || split_part(winner_email,'@',2)
    END as winner_display
  FROM public.giveaways
  WHERE status IN ('drawn','ended')
    AND winner_email IS NOT NULL
    AND winner_announced_at IS NOT NULL
  ORDER BY winner_announced_at DESC NULLS LAST
  LIMIT _limit;
$function$;