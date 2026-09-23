
CREATE TABLE public.stock_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  allowed_product_id UUID NOT NULL REFERENCES public.allowed_products(id) ON DELETE CASCADE,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one notification per email per product
ALTER TABLE public.stock_notifications ADD CONSTRAINT stock_notifications_email_product_unique UNIQUE (email, allowed_product_id);

-- Enable RLS
ALTER TABLE public.stock_notifications ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (subscribe for notifications)
CREATE POLICY "Anyone can subscribe for stock notifications"
  ON public.stock_notifications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read/update
CREATE POLICY "Admins can manage stock notifications"
  ON public.stock_notifications
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
