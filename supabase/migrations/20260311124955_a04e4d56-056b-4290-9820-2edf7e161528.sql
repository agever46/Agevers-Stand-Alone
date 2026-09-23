
CREATE TABLE public.seller_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT NOT NULL,
  business_name TEXT,
  product_types TEXT NOT NULL,
  experience TEXT,
  why_sell TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;

-- Users can insert their own application
CREATE POLICY "Users can submit applications"
ON public.seller_applications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own applications
CREATE POLICY "Users can view own applications"
ON public.seller_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.seller_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update applications
CREATE POLICY "Admins can update applications"
ON public.seller_applications
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete applications
CREATE POLICY "Admins can delete applications"
ON public.seller_applications
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
