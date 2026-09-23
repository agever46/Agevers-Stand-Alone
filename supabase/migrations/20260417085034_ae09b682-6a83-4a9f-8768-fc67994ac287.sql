
-- Title cleaner
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
  result := regexp_replace(result, '\s*\+\s*Pre[-\s]?order(\s+Bonus)?', '', 'gi');
  result := regexp_replace(result, '\s*-\s*Pre[-\s]?order(\s+Bonus)?(\s+DLC)?', '', 'gi');
  result := regexp_replace(result, '\s*\bPre[-\s]?order(\s+Bonus)?(\s+DLC)?\b', '', 'gi');
  result := regexp_replace(result, '\s{2,}', ' ', 'g');
  result := regexp_replace(result, '\s*-\s*-\s*', ' - ', 'g');
  result := regexp_replace(result, '^\s*[-,]\s*', '', 'g');
  result := regexp_replace(result, '\s*[-,]\s*$', '', 'g');
  result := btrim(result);
  RETURN result;
END;
$$;

-- Slug cleaner
CREATE OR REPLACE FUNCTION public.strip_preorder_from_slug(_slug text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text := _slug;
BEGIN
  IF result IS NULL THEN RETURN NULL; END IF;
  result := regexp_replace(result, '-pre-order(-bonus)?(-dlc)?', '', 'gi');
  result := regexp_replace(result, 'pre-order(-bonus)?(-dlc)?-', '', 'gi');
  result := regexp_replace(result, '-{2,}', '-', 'g');
  result := btrim(result, '-');
  RETURN result;
END;
$$;

-- Backfill: skip rows whose cleaned title collides with another product
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

    -- Skip if cleaned title collides with another product (safer than renaming)
    IF EXISTS (
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

-- Trigger function: skip title rewrite on collision
CREATE OR REPLACE FUNCTION public.auto_strip_preorder_when_released()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  proposed_title text;
  candidate text;
  n int;
BEGIN
  IF NEW.release_date IS NOT NULL AND NEW.release_date <= now() THEN
    IF NEW.title ILIKE '%pre-order%' OR NEW.title ILIKE '%pre order%' THEN
      proposed_title := public.strip_preorder_from_title(NEW.title);
      IF NOT EXISTS (
        SELECT 1 FROM public.allowed_products p
        WHERE p.title = proposed_title AND p.id <> NEW.id
      ) THEN
        NEW.title := proposed_title;
      END IF;
    END IF;
    IF NEW.slug ILIKE '%pre-order%' THEN
      candidate := public.strip_preorder_from_slug(NEW.slug);
      NEW.slug := candidate;
      n := 2;
      WHILE EXISTS (
        SELECT 1 FROM public.allowed_products p
        WHERE p.slug = NEW.slug AND p.id <> NEW.id
      ) LOOP
        NEW.slug := candidate || '-' || n::text;
        n := n + 1;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_strip_preorder_when_released ON public.allowed_products;
CREATE TRIGGER trg_auto_strip_preorder_when_released
BEFORE INSERT OR UPDATE ON public.allowed_products
FOR EACH ROW
EXECUTE FUNCTION public.auto_strip_preorder_when_released();

-- Daily cron (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('strip-preorder-released-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

SELECT cron.schedule(
  'strip-preorder-released-daily',
  '15 0 * * *',
  $$
    DO $body$
    DECLARE
      r RECORD;
      new_title text;
      candidate text;
      new_slug text;
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
        IF EXISTS (
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
    $body$;
  $$
);
