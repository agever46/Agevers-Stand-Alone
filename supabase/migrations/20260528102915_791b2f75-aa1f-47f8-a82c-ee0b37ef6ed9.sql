
CREATE TABLE public.overpriced_card_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_batch_id UUID NOT NULL,
  product_id UUID NOT NULL,
  kinguin_product_row_id UUID,
  title TEXT NOT NULL,
  sell_price NUMERIC NOT NULL,
  kinguin_price NUMERIC,
  kinguin_stock INTEGER,
  face_value NUMERIC NOT NULL,
  face_currency TEXT NOT NULL,
  face_value_eur NUMERIC NOT NULL,
  sell_vs_face_ratio NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_overpriced_card_scans_batch ON public.overpriced_card_scans(scan_batch_id);
CREATE INDEX idx_overpriced_card_scans_ratio ON public.overpriced_card_scans(sell_vs_face_ratio DESC);
CREATE INDEX idx_overpriced_card_scans_created ON public.overpriced_card_scans(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.overpriced_card_scans TO authenticated;
GRANT ALL ON public.overpriced_card_scans TO service_role;

ALTER TABLE public.overpriced_card_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view overpriced scans"
ON public.overpriced_card_scans
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete overpriced scans"
ON public.overpriced_card_scans
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- service_role bypasses RLS for inserts from edge function
