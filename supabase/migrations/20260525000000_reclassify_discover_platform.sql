-- Reclassify Discover suggestions where the title indicates a specific console
-- but Kinguin returned a generic "PC" (typically MS Store cross-buy listings).
UPDATE public.kinguin_product_suggestions
SET platform = 'Xbox', store = 'Xbox'
WHERE platform = 'PC' AND title ~* '\mxbox\M';

UPDATE public.kinguin_product_suggestions
SET platform = 'PlayStation', store = 'PlayStation'
WHERE platform = 'PC' AND title ~* '\m(playstation|ps[345])\M';

UPDATE public.kinguin_product_suggestions
SET platform = 'Nintendo', store = 'Nintendo'
WHERE platform = 'PC' AND title ~* '\m(nintendo|switch)\M';
