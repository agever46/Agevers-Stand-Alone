-- Remove the broken duplicate row first
DELETE FROM kinguin_products WHERE allowed_product_id = '0b0abdb2-62c1-4b63-bd9c-abf6d0a90b6d';
DELETE FROM allowed_products WHERE id = '0b0abdb2-62c1-4b63-bd9c-abf6d0a90b6d';

-- Clean any other titles with hex region tags or stray leading punctuation,
-- using collision-safe per-row updates
DO $$
DECLARE
  rec RECORD;
  cleaned TEXT;
BEGIN
  FOR rec IN
    SELECT id, title FROM allowed_products
    WHERE title ~ '\[[0-9a-fA-F]{3,4}\]' OR title ~ '^\s*[:\-]'
  LOOP
    cleaned := TRIM(BOTH ' -:' FROM
      regexp_replace(
        regexp_replace(rec.title, '\s*\[[0-9a-fA-F]{3,4}\]\s*', ' ', 'g'),
        '\s+', ' ', 'g'
      )
    );
    -- Skip if collision would occur
    IF cleaned <> rec.title
       AND NOT EXISTS (SELECT 1 FROM allowed_products WHERE title = cleaned AND id <> rec.id)
       AND cleaned <> ''
    THEN
      UPDATE allowed_products SET title = cleaned WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

-- Same cleanup for original_title (no unique constraint)
UPDATE allowed_products
SET original_title = TRIM(BOTH ' -:' FROM
  regexp_replace(
    regexp_replace(original_title, '\s*\[[0-9a-fA-F]{3,4}\]\s*', ' ', 'g'),
    '\s+', ' ', 'g'
  )
)
WHERE original_title ~ '\[[0-9a-fA-F]{3,4}\]'
   OR original_title ~ '^\s*[:\-]';