-- Fix Anno 1404 Gold misclassified as Currency (it's a full game / Gold Edition)
UPDATE allowed_products
SET product_type = 'Edition',
    title = 'Anno 1404 Gold Edition GOG - PC - Global'
WHERE id = 'd75d2d91-7fef-4e05-811f-d1bbf339a24e'
  AND NOT EXISTS (
    SELECT 1 FROM allowed_products
    WHERE title = 'Anno 1404 Gold Edition GOG - PC - Global'
      AND id <> 'd75d2d91-7fef-4e05-811f-d1bbf339a24e'
  );

-- If the cleaned title would collide with the second product, just fix the type
UPDATE allowed_products
SET product_type = 'Edition'
WHERE id = 'd75d2d91-7fef-4e05-811f-d1bbf339a24e';

-- Strip leading "[Gold Edition] " bracket prefix from second product
UPDATE allowed_products
SET title = regexp_replace(title, '^\s*\[[^\]]+\]\s*', ''),
    original_title = regexp_replace(COALESCE(original_title, ''), '^\s*\[[^\]]+\]\s*', '')
WHERE id = '8029fbe4-4c4c-46c2-be77-49101fe3e1fd';

-- General cleanup: strip leading bracketed labels from any other titles that have them
DO $$
DECLARE
  rec RECORD;
  cleaned TEXT;
BEGIN
  FOR rec IN
    SELECT id, title FROM allowed_products
    WHERE title ~ '^\s*\[[^\]]+\]\s'
  LOOP
    cleaned := TRIM(regexp_replace(rec.title, '^\s*\[[^\]]+\]\s*', ''));
    IF cleaned <> rec.title
       AND cleaned <> ''
       AND NOT EXISTS (SELECT 1 FROM allowed_products WHERE title = cleaned AND id <> rec.id)
    THEN
      UPDATE allowed_products SET title = cleaned WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;