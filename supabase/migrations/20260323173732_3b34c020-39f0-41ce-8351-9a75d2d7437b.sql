
-- Step 1: Delete duplicate entries that would conflict (keep the clean version)
DELETE FROM allowed_products WHERE id IN (
  '68aabf41-f1a0-4018-beef-1d45f3d28050',
  '406dfcf6-30f5-4e30-ba4d-e070c5d8c2ce'
);

-- Step 2: Remove redundant 2-letter country codes from all remaining titles
UPDATE allowed_products 
SET title = regexp_replace(
  title, 
  ' ([A-Z]{2}) - (Gift Cards|Media & Streaming|Software|PC|Xbox|PlayStation|Nintendo) - ', 
  ' - \2 - '
)
WHERE title ~ ' [A-Z]{2} - (Gift Cards|Media & Streaming|Software|PC|Xbox|PlayStation|Nintendo) - ';
