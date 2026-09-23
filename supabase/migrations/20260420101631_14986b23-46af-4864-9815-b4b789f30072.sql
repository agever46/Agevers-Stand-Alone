-- Search products by title, developers, or publishers (substring, case-insensitive, apostrophe-insensitive)
CREATE OR REPLACE FUNCTION public.search_products_with_metadata(_words text[])
RETURNS SETOF public.allowed_products
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ap.*
  FROM public.allowed_products ap
  WHERE (
    SELECT bool_and(
      -- title match (apostrophe-insensitive)
      replace(replace(lower(ap.title), '''', ''), '’', '') ILIKE '%' || w || '%'
      -- developer match (any element contains the word, case-insensitive)
      OR EXISTS (SELECT 1 FROM unnest(COALESCE(ap.developers, '{}')) d WHERE lower(d) LIKE '%' || w || '%')
      -- publisher match
      OR EXISTS (SELECT 1 FROM unnest(COALESCE(ap.publishers, '{}')) p WHERE lower(p) LIKE '%' || w || '%')
    )
    FROM unnest(_words) AS w
  )
  LIMIT 500;
$$;

-- Allow public to call (RLS still applies via SECURITY DEFINER returning allowed_products which is public-readable anyway)
GRANT EXECUTE ON FUNCTION public.search_products_with_metadata(text[]) TO anon, authenticated;