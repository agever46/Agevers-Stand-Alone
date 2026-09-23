-- Fix Grab Food collection: target_page was not set, causing it to be hidden from Gift Cards page
UPDATE public.collections
SET target_page = 'Gift Cards'
WHERE id = '594638d8-9086-499e-8d37-e1783f0590d1'
  AND target_page IS NULL;
