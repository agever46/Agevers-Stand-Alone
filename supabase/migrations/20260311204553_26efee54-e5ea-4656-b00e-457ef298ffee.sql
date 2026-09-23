
CREATE TABLE public.seller_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  price_change_alert boolean NOT NULL DEFAULT false,
  low_stock_alert boolean NOT NULL DEFAULT false,
  low_stock_threshold integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view own preferences"
ON public.seller_notification_preferences
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Sellers can insert own preferences"
ON public.seller_notification_preferences
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'seller'::app_role));

CREATE POLICY "Sellers can update own preferences"
ON public.seller_notification_preferences
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'seller'::app_role))
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'seller'::app_role));
