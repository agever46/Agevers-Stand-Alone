-- Fix products with "Southeast Asia" in title that are not classified correctly
UPDATE public.allowed_products
SET region = 'Southeast Asia'
WHERE title ~* '\m(southeast asia|south east asia)\M'
  AND region NOT IN ('Southeast Asia');

-- Fix products with "Asia" in title (but not Southeast Asia) classified incorrectly
UPDATE public.allowed_products
SET region = 'Asia'
WHERE title ~* '\masia\M'
  AND title !~* '\m(southeast asia|south east asia)\M'
  AND region NOT IN ('Asia', 'Southeast Asia');