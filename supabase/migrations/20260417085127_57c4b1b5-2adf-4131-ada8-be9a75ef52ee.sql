
CREATE OR REPLACE FUNCTION public.strip_preorder_from_title(_title text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text := _title;
BEGIN
  IF result IS NULL THEN RETURN NULL; END IF;
  -- "+ Pre-order Bonus" / "+ Pre-order"
  result := regexp_replace(result, '\s*\+\s*Pre[-\s]?order(\s+Bonus)?', '', 'gi');
  -- " - Pre-order Bonus DLC" / " - Pre-order Bonus" / " - Pre-order"
  result := regexp_replace(result, '\s*-\s*Pre[-\s]?order(\s+Bonus)?(\s+DLC)?', '', 'gi');
  -- Standalone "Pre-order Bonus DLC" / "Pre-order Bonus" / "Pre-order" with word boundaries
  result := regexp_replace(result, '\s*\yPre[-\s]?order(\s+Bonus)?(\s+DLC)?\y', '', 'gi');
  -- Cleanup leftovers
  result := regexp_replace(result, '\s{2,}', ' ', 'g');
  result := regexp_replace(result, '\s*-\s*-\s*', ' - ', 'g');
  result := regexp_replace(result, '^\s*[-,]\s*', '', 'g');
  result := regexp_replace(result, '\s*[-,]\s*$', '', 'g');
  result := btrim(result);
  RETURN result;
END;
$$;

-- Re-run backfill (skip on title collision)
DO $$
DECLARE
  r RECORD;
  new_title text;
  new_slug text;
  candidate text;
  n int;
BEGIN
  FOR r IN
    SELECT id, title, slug
    FROM public.allowed_products
    WHERE release_date IS NOT NULL
      AND release_date <= now()
      AND (title ILIKE '%pre-order%' OR title ILIKE '%pre order%' OR slug ILIKE '%pre-order%')
  LOOP
    new_title := public.strip_preorder_from_title(r.title);

    IF new_title <> r.title AND EXISTS (
      SELECT 1 FROM public.allowed_products p
      WHERE p.title = new_title AND p.id <> r.id
    ) THEN
      CONTINUE;
    END IF;

    candidate := public.strip_preorder_from_slug(r.slug);
    new_slug := candidate;
    n := 2;
    WHILE EXISTS (
      SELECT 1 FROM public.allowed_products p
      WHERE p.slug = new_slug AND p.id <> r.id
    ) LOOP
      new_slug := candidate || '-' || n::text;
      n := n + 1;
    END LOOP;

    UPDATE public.allowed_products
    SET title = new_title, slug = new_slug
    WHERE id = r.id;
  END LOOP;
END;
$$;
