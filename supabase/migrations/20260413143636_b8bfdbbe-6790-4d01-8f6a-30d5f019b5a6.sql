
-- 1. Add slug column
ALTER TABLE public.allowed_products ADD COLUMN slug text;

-- 2. Create function to generate slug
CREATE OR REPLACE FUNCTION public.generate_product_slug(p_title text, p_store text, p_region text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  base_title text;
  slug text;
  plat text;
  reg text;
BEGIN
  base_title := regexp_replace(p_title, '\s*-\s*[^-]+\s*-\s*[^-]+\s*$', '');
  base_title := trim(base_title);
  slug := lower(base_title);
  slug := regexp_replace(slug, '[^a-z0-9\s-]', '', 'g');
  slug := regexp_replace(slug, '\s+', '-', 'g');
  slug := regexp_replace(slug, '-+', '-', 'g');
  slug := trim(both '-' from slug);
  plat := lower(p_store);
  plat := regexp_replace(plat, '[^a-z0-9]+', '-', 'g');
  plat := trim(both '-' from plat);
  slug := slug || '-' || plat || '-key';
  reg := lower(p_region);
  reg := regexp_replace(reg, '[^a-z0-9]+', '-', 'g');
  reg := trim(both '-' from reg);
  slug := slug || '-' || reg;
  RETURN slug;
END;
$$;

-- 3. Populate slugs with deduplication using row_number
WITH ranked AS (
  SELECT id, 
         generate_product_slug(title, store, region) as base_slug,
         ROW_NUMBER() OVER (PARTITION BY generate_product_slug(title, store, region) ORDER BY created_at ASC) as rn
  FROM allowed_products
)
UPDATE allowed_products ap
SET slug = CASE 
  WHEN r.rn = 1 THEN r.base_slug
  ELSE r.base_slug || '-' || r.rn
END
FROM ranked r
WHERE ap.id = r.id;

-- 4. Make NOT NULL
ALTER TABLE public.allowed_products ALTER COLUMN slug SET NOT NULL;

-- 5. Unique index
CREATE UNIQUE INDEX idx_allowed_products_slug ON public.allowed_products(slug);

-- 6. Trigger for new products
CREATE OR REPLACE FUNCTION public.set_product_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := generate_product_slug(NEW.title, NEW.store, NEW.region);
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM allowed_products WHERE slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_product_slug
BEFORE INSERT ON public.allowed_products
FOR EACH ROW
EXECUTE FUNCTION public.set_product_slug();
