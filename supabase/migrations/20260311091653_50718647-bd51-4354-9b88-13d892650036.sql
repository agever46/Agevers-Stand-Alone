
CREATE TABLE public.product_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  title text NOT NULL,
  platform text NOT NULL DEFAULT 'PC',
  store text NOT NULL DEFAULT 'Steam',
  region text NOT NULL DEFAULT 'Global',
  description text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;

-- Sellers can insert their own requests
CREATE POLICY "Sellers can insert requests"
  ON public.product_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requested_by AND has_role(auth.uid(), 'seller'));

-- Sellers can view their own requests
CREATE POLICY "Sellers can view own requests"
  ON public.product_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = requested_by);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
  ON public.product_requests FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update requests"
  ON public.product_requests FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admins can delete requests
CREATE POLICY "Admins can delete requests"
  ON public.product_requests FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
