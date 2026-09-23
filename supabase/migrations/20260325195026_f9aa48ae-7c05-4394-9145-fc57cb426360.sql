
-- Nav menu items table for dynamic navigation management
CREATE TABLE public.nav_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  href text NOT NULL,
  parent_id uuid REFERENCES public.nav_menu_items(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nav_menu_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view visible items
CREATE POLICY "Anyone can view visible nav items"
  ON public.nav_menu_items FOR SELECT TO public
  USING (is_visible = true);

-- Admins can manage all nav items
CREATE POLICY "Admins can manage nav items"
  ON public.nav_menu_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed with current hardcoded data
-- Top-level items
INSERT INTO public.nav_menu_items (id, name, href, parent_id, display_order) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'PC', '#pc', NULL, 0),
  ('a0000001-0000-0000-0000-000000000002', 'Xbox', '/xbox', NULL, 1),
  ('a0000001-0000-0000-0000-000000000003', 'PlayStation', '/playstation', NULL, 2),
  ('a0000001-0000-0000-0000-000000000004', 'Nintendo', '/nintendo', NULL, 3),
  ('a0000001-0000-0000-0000-000000000005', 'Software', '/software', NULL, 4),
  ('a0000001-0000-0000-0000-000000000006', 'In-Game Items', '/in-game-items', NULL, 5),
  ('a0000001-0000-0000-0000-000000000007', 'Gift Cards', '/gift-cards', NULL, 6),
  ('a0000001-0000-0000-0000-000000000008', 'Media & Streaming', '/media-streaming', NULL, 7),
  ('a0000001-0000-0000-0000-000000000009', 'Pre-Order', '/pre-order', NULL, 8);

-- PC subcategories
INSERT INTO public.nav_menu_items (name, href, parent_id, display_order) VALUES
  ('Steam', '/steam', 'a0000001-0000-0000-0000-000000000001', 0),
  ('Windows Store', '/windows-store', 'a0000001-0000-0000-0000-000000000001', 1),
  ('GOG', '/gog', 'a0000001-0000-0000-0000-000000000001', 2),
  ('Epic Games', '/epic-games', 'a0000001-0000-0000-0000-000000000001', 3),
  ('Blizzard', '/blizzard', 'a0000001-0000-0000-0000-000000000001', 4),
  ('EA Games', '/ea-games', 'a0000001-0000-0000-0000-000000000001', 5),
  ('Rockstar', '/rockstar', 'a0000001-0000-0000-0000-000000000001', 6);

-- Xbox subcategories
INSERT INTO public.nav_menu_items (name, href, parent_id, display_order) VALUES
  ('Games', '/xbox?tab=games', 'a0000001-0000-0000-0000-000000000002', 0),
  ('Subscriptions', '/xbox?tab=subscriptions', 'a0000001-0000-0000-0000-000000000002', 1),
  ('Top Ups', '/xbox?tab=topups', 'a0000001-0000-0000-0000-000000000002', 2);

-- PlayStation subcategories
INSERT INTO public.nav_menu_items (name, href, parent_id, display_order) VALUES
  ('Games', '/playstation?tab=games', 'a0000001-0000-0000-0000-000000000003', 0),
  ('Subscriptions', '/playstation?tab=subscriptions', 'a0000001-0000-0000-0000-000000000003', 1),
  ('Top Ups', '/playstation?tab=topups', 'a0000001-0000-0000-0000-000000000003', 2);

-- Nintendo subcategories
INSERT INTO public.nav_menu_items (name, href, parent_id, display_order) VALUES
  ('Games', '/nintendo?tab=games', 'a0000001-0000-0000-0000-000000000004', 0),
  ('Subscriptions', '/nintendo?tab=subscriptions', 'a0000001-0000-0000-0000-000000000004', 1),
  ('Top Ups', '/nintendo?tab=topups', 'a0000001-0000-0000-0000-000000000004', 2);

-- Software subcategories
INSERT INTO public.nav_menu_items (name, href, parent_id, display_order) VALUES
  ('AI', '/software/ai', 'a0000001-0000-0000-0000-000000000005', 0);
