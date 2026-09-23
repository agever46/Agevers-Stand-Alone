
CREATE TABLE public.seller_payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE,
  paypal_email text,
  payoneer_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view own payment accounts"
  ON public.seller_payment_accounts FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert own payment accounts"
  ON public.seller_payment_accounts FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = auth.uid() AND has_role(auth.uid(), 'seller'::app_role));

CREATE POLICY "Sellers can update own payment accounts"
  ON public.seller_payment_accounts FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid() AND has_role(auth.uid(), 'seller'::app_role))
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Admins can view all payment accounts"
  ON public.seller_payment_accounts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
