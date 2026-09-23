-- Remove "- Other -" from titles (replace with " - ")
UPDATE allowed_products
SET title = regexp_replace(title, '\s*-\s*Other\s*-\s*', ' - ', 'gi')
WHERE title ~* '- Other -';

-- Remove trailing "- Other" from titles
UPDATE allowed_products
SET title = regexp_replace(title, '\s*-\s*Other\s*$', '', 'i')
WHERE title ~* '- Other$';
