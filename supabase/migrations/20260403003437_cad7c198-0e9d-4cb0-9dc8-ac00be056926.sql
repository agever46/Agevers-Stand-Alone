
-- Wholesale Inquiries
CREATE TABLE public.wholesale_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  tax_id TEXT,
  business_address TEXT NOT NULL,
  sales_channels TEXT NOT NULL DEFAULT 'online',
  website_url TEXT,
  monthly_order_volume TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wholesale_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit wholesale inquiry"
  ON public.wholesale_inquiries FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins can manage wholesale inquiries"
  ON public.wholesale_inquiries FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Affiliate Applications
CREATE TABLE public.affiliate_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  instagram_handle TEXT,
  tiktok_handle TEXT,
  youtube_handle TEXT,
  primary_niche TEXT NOT NULL,
  follower_count TEXT NOT NULL,
  promotion_plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit affiliate application"
  ON public.affiliate_applications FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins can manage affiliate applications"
  ON public.affiliate_applications FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Partnership Proposals
CREATE TABLE public.partnership_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  representative_name TEXT NOT NULL,
  email TEXT NOT NULL,
  job_title TEXT NOT NULL,
  company_industry TEXT NOT NULL,
  proposal TEXT NOT NULL,
  strategic_goals TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partnership_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit partnership proposal"
  ON public.partnership_proposals FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins can manage partnership proposals"
  ON public.partnership_proposals FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_wholesale_inquiries_updated_at
  BEFORE UPDATE ON public.wholesale_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliate_applications_updated_at
  BEFORE UPDATE ON public.affiliate_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partnership_proposals_updated_at
  BEFORE UPDATE ON public.partnership_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
