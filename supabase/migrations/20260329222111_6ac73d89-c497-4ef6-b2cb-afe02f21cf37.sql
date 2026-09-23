
CREATE TABLE public.carousel_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_position integer NOT NULL UNIQUE CHECK (slot_position BETWEEN 0 AND 5),
  allowed_product_id uuid NOT NULL,
  title text NOT NULL,
  image_url text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.carousel_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view carousel slots"
  ON public.carousel_slots FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins can manage carousel slots"
  ON public.carousel_slots FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
