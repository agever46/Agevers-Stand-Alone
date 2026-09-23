-- Abandoned carts table
CREATE TABLE public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cart_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cart snapshot" ON public.abandoned_carts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.abandoned_carts
  FOR ALL USING (true) WITH CHECK (true);

-- Frequently bought together RPC
CREATE OR REPLACE FUNCTION public.get_frequently_bought_together(_product_title text, _platform text, _limit int DEFAULT 6)
RETURNS TABLE(
  id uuid, title text, platform text, image_url text, slug text, store text, region text, sold_count int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- First try: real co-purchase data from orders
  RETURN QUERY
    SELECT DISTINCT ap.id, ap.title, ap.platform, ap.image_url, ap.slug, ap.store, ap.region, ap.sold_count
    FROM orders o1
    JOIN orders o2 ON o1.user_id = o2.user_id AND o1.game_title != o2.game_title
    JOIN allowed_products ap ON lower(ap.title) = lower(o2.game_title)
    JOIN kinguin_products kp ON kp.allowed_product_id = ap.id AND kp.is_active = true AND kp.kinguin_stock > 0
    WHERE lower(o1.game_title) = lower(_product_title)
    ORDER BY ap.sold_count DESC
    LIMIT _limit;

  -- If we got results, return
  IF FOUND THEN RETURN; END IF;

  -- Fallback: same platform, different product, in stock
  RETURN QUERY
    SELECT ap.id, ap.title, ap.platform, ap.image_url, ap.slug, ap.store, ap.region, ap.sold_count
    FROM allowed_products ap
    JOIN kinguin_products kp ON kp.allowed_product_id = ap.id AND kp.is_active = true AND kp.kinguin_stock > 0
    WHERE ap.platform = _platform
      AND lower(ap.title) != lower(_product_title)
    ORDER BY ap.sold_count DESC
    LIMIT _limit;
END;
$$;