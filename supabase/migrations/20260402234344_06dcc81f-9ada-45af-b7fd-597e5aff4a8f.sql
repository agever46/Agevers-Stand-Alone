
CREATE TABLE public.discount_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  min_order_amount numeric DEFAULT 0,
  emailed_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage discount codes"
  ON public.discount_codes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active codes"
  ON public.discount_codes FOR SELECT
  TO authenticated
  USING (is_active = true);
