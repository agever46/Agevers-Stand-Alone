-- Enum for item types
CREATE TYPE public.game_item_type AS ENUM ('base', 'dlc', 'skin', 'currency', 'edition');

-- game_groups: the group container
CREATE TABLE public.game_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  image_url TEXT,
  base_product_id UUID REFERENCES public.allowed_products(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- game_group_items: items inside the group
CREATE TABLE public.game_group_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.game_groups(id) ON DELETE CASCADE,
  allowed_product_id UUID NOT NULL REFERENCES public.allowed_products(id) ON DELETE CASCADE,
  item_type public.game_item_type NOT NULL DEFAULT 'base',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (group_id, allowed_product_id)
);

CREATE INDEX idx_game_group_items_group ON public.game_group_items(group_id);
CREATE INDEX idx_game_group_items_product ON public.game_group_items(allowed_product_id);
CREATE INDEX idx_game_groups_slug ON public.game_groups(slug);

-- RLS
ALTER TABLE public.game_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_group_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active game groups"
  ON public.game_groups FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage game groups"
  ON public.game_groups FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view game group items"
  ON public.game_group_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_groups gg
      WHERE gg.id = game_group_items.group_id AND gg.is_active = true
    )
  );

CREATE POLICY "Admins can manage game group items"
  ON public.game_group_items FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER update_game_groups_updated_at
  BEFORE UPDATE ON public.game_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();