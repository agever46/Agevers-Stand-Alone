UPDATE allowed_products
SET product_type = 'Pre-Order'
WHERE product_type IN ('Game', 'Edition')
  AND COALESCE(original_title, title) ~* '\mpre[\s-]?order\M'
  AND COALESCE(original_title, title) !~* '\mpre[\s-]?order\s+bonus\M'
  AND COALESCE(original_title, title) !~* '\+\s*(pre[\s-]?order\s+)?bonus\M';

WITH cleaned AS (
  SELECT
    id,
    title AS old_title,
    TRIM(BOTH ' -' FROM
      regexp_replace(
        regexp_replace(
          regexp_replace(title, '^\s*PRE[\s-]?ORDER\s*[:\-–—]?\s*', '', 'i'),
          '\s*[-–—:+]?\s*\mPRE[\s-]?ORDER\M\s*', ' ', 'gi'
        ),
        '\s+', ' ', 'g'
      )
    ) AS candidate
  FROM allowed_products
  WHERE product_type = 'Pre-Order'
    AND title ~* '\mpre[\s-]?order\M'
),
finalized AS (
  SELECT
    c.id,
    c.candidate,
    c.old_title,
    -- If candidate already collides, suffix it; if collisions among the cleaned set itself, number them.
    CASE
      WHEN EXISTS (SELECT 1 FROM allowed_products ap2 WHERE ap2.title = c.candidate AND ap2.id <> c.id)
        OR (SELECT COUNT(*) FROM cleaned c2 WHERE c2.candidate = c.candidate) > 1
      THEN c.candidate || ' (Pre-Order ' || ROW_NUMBER() OVER (PARTITION BY c.candidate ORDER BY c.id) || ')'
      ELSE c.candidate
    END AS new_title
  FROM cleaned c
)
UPDATE allowed_products ap
SET title = f.new_title
FROM finalized f
WHERE ap.id = f.id
  AND f.new_title <> f.old_title
  AND f.candidate <> '';