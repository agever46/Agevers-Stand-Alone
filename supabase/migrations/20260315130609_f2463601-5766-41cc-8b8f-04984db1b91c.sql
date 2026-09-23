
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  issue_type TEXT NOT NULL,
  message TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Buyers can create tickets and view their own
CREATE POLICY "Buyers can create tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);

-- Sellers can view tickets assigned to them
CREATE POLICY "Sellers can view their tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);

-- Sellers can update their tickets (status, admin_note)
CREATE POLICY "Sellers can update their tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Admins can view and update all tickets
CREATE POLICY "Admins can view all tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
