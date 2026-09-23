CREATE OR REPLACE FUNCTION public.auto_strip_preorder_when_released()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  proposed_title text;
  candidate text;
  n int;
  is_bonus boolean;
BEGIN
  is_bonus := (
    NEW.title ILIKE '%pre-order bonus%'
    OR NEW.title ILIKE '%pre order bonus%'
    OR NEW.title ILIKE '%preorder bonus%'
    OR COALESCE(NEW.description, '') ILIKE '%pre-order bonus%'
    OR COALESCE(NEW.description, '') ILIKE '%pre order bonus%'
    OR COALESCE(NEW.description, '') ILIKE '%preorder bonus%'
  );

  IF NEW.release_date IS NOT NULL AND NEW.release_date <= now() AND NOT is_bonus THEN
    IF NEW.title ILIKE '%pre-order%' OR NEW.title ILIKE '%pre order%' THEN
      proposed_title := public.strip_preorder_from_title(NEW.title);
      -- Always strip the outdated wording, even when a similarly named
      -- product already exists: the label must never outlive the release date.
      NEW.title := proposed_title;
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