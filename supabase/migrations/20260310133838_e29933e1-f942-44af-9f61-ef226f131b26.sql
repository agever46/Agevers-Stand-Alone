
ALTER TABLE public.allowed_products
  ADD COLUMN platform text NOT NULL DEFAULT 'PC',
  ADD COLUMN image_url text,
  ADD COLUMN description text;
