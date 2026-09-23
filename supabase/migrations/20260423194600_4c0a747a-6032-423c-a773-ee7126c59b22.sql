-- Map duplicate (EMEA) IDs to canonical (Europe) IDs
DO $$
DECLARE
  pairs TEXT[][] := ARRAY[
    ['11582c1e-23dc-4ae5-a14f-f2beeac331de', '70f97ebb-7b47-443d-8e54-6c1c551a2848'],
    ['bdd1c295-d152-4505-a4d6-788b37db04c4', 'd45a1c8e-b5c7-4f3f-8fac-9f10867252d8'],
    ['fe4938ee-6272-4159-a4f0-bc28b31ce1a7', 'f43451b3-ee99-4d51-ab5a-7fe003f6e078'],
    ['fdafcf93-04c3-44ef-bdc0-1e30c74fe1e1', '5a37d500-44e7-43ca-8955-00d0d4615ae8']
  ];
  pair TEXT[];
  dup_id UUID;
  canon_id UUID;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs LOOP
    dup_id := pair[1]::UUID;
    canon_id := pair[2]::UUID;

    -- Move kinguin_products link only if canonical doesn't already have one
    UPDATE kinguin_products
    SET allowed_product_id = canon_id
    WHERE allowed_product_id = dup_id
      AND NOT EXISTS (SELECT 1 FROM kinguin_products WHERE allowed_product_id = canon_id);

    -- Delete any remaining kinguin_products for the duplicate
    DELETE FROM kinguin_products WHERE allowed_product_id = dup_id;

    -- Delete the duplicate allowed_product
    DELETE FROM allowed_products WHERE id = dup_id;
  END LOOP;
END $$;

-- Now safe to clean up double dashes/spaces in remaining titles
UPDATE allowed_products
SET title = REGEXP_REPLACE(REGEXP_REPLACE(title, '\s+-\s+-\s+', ' - ', 'g'), '\s{2,}', ' ', 'g')
WHERE title ~ '\s+-\s+-\s+' OR title ~ '\s{2,}';