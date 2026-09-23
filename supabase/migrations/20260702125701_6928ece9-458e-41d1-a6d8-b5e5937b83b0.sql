-- Update existing Windows nav item to point to the new Windows store page
UPDATE public.nav_menu_items
SET href = '/software/windows', updated_at = now()
WHERE name = 'Windows' AND parent_id = '1575ca28-3f63-4f86-a04a-a5c40ffb60e4';

-- Remove the AI sub-category under Software
DELETE FROM public.nav_menu_items
WHERE name = 'AI' AND parent_id = '1575ca28-3f63-4f86-a04a-a5c40ffb60e4';

-- Move Windows OS keys from Software/AI to Software/Windows
UPDATE public.allowed_products
SET platform = 'Software', store = 'Windows'
WHERE platform = 'Software' AND store = 'AI'
  AND title ~* 'Windows (10|11|7|8|Pro|Professional|Home|Enterprise|Education|Retail|OEM|Key|CD Key|Activation|License)';

-- Move any remaining AI-classified products to the general Software store
UPDATE public.allowed_products
SET store = 'Software'
WHERE platform = 'Software' AND store = 'AI';