
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'paypal',
  paypal_email text,
  payoneer_email text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own withdrawal requests
CREATE POLICY "Sellers can view own withdrawals"
ON public.withdrawal_requests
FOR SELECT
TO authenticated
USING (seller_id = auth.uid());

-- Sellers can insert their own withdrawal requests
CREATE POLICY "Sellers can request withdrawals"
ON public.withdrawal_requests
FOR INSERT
TO authenticated
WITH CHECK (seller_id = auth.uid() AND has_role(auth.uid(), 'seller'::app_role));

-- Admins can manage all withdrawal requests
CREATE POLICY "Admins can manage withdrawals"
ON public.withdrawal_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
