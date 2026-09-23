CREATE OR REPLACE FUNCTION public.search_products_with_metadata(_words text[])
RETURNS SETOF allowed_products
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ap.*
  FROM public.allowed_products ap
  WHERE (
    SELECT bool_and(
      -- title match (apostrophe-insensitive, word-boundary)
      replace(replace(lower(ap.title), '''', ''), '’', '') ~* ('\m' || regexp_replace(w, '([\\.^$*+?()\[\]{}|])', '\\\1', 'g') || '\M')
      -- developer match (word-boundary)
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(ap.developers, '{}')) d
        WHERE lower(d) ~* ('\m' || regexp_replace(w, '([\\.^$*+?()\[\]{}|])', '\\\1', 'g') || '\M')
      )
      -- publisher match (word-boundary)
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(ap.publishers, '{}')) p
        WHERE lower(p) ~* ('\m' || regexp_replace(w, '([\\.^$*+?()\[\]{}|])', '\\\1', 'g') || '\M')
      )
    )
    FROM unnest(_words) AS w
  )
  LIMIT 500;
$function$;