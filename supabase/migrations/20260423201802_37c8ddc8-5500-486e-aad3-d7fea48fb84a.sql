-- Re-prefix Pre-Order products with a single "PRE-ORDER:" prefix in the title
-- Strip any duplicate "PRE-ORDER" / "Pre-order" tokens, then prepend exactly one "PRE-ORDER: "

WITH cleaned AS (
  SELECT
    id,
    title AS old_title,
    -- Step 1: collapse spaces, remove leading "PRE-ORDER:" and any inline "Pre-order" tokens, then prepend
    'PRE-ORDER: ' || TRIM(BOTH ' -:' FROM
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(title, '^\s*PRE[\s-]?ORDER\s*[:\-–—]?\s*', '', 'i'),
            '\s*[-–—:+]?\s*\mPRE[\s-]?ORDER\M\s*', ' ', 'gi'
          ),
          '\(Pre-Order\s*\d+\)', '', 'gi'
        ),
        '\s+', ' ', 'g'
      )
    ) AS candidate
  FROM allowed_products
  WHERE product_type = 'Pre-Order'
),
finalized AS (
  SELECT
    c.id,
    c.candidate,
    c.old_title,
    CASE
      WHEN EXISTS (SELECT 1 FROM allowed_products ap2 WHERE ap2.title = c.candidate AND ap2.id <> c.id)
        OR (SELECT COUNT(*) FROM cleaned c2 WHERE c2.candidate = c.candidate) > 1
      THEN c.candidate || ' (' || ROW_NUMBER() OVER (PARTITION BY c.candidate ORDER BY c.id) || ')'
      ELSE c.candidate
    END AS new_title
  FROM cleaned c
)
UPDATE allowed_products ap
SET title = f.new_title
FROM finalized f
WHERE ap.id = f.id
  AND f.new_title <> f.old_title;