-- Marketing campaigns table
CREATE TABLE public.marketing_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  preview_text TEXT,
  from_name TEXT NOT NULL DEFAULT 'Agever''s',
  from_email TEXT NOT NULL DEFAULT 'marketing@updates.agevers.com',
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sending | sent | failed
  recipient_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_failed INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage marketing campaigns"
  ON public.marketing_campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manage marketing campaigns"
  ON public.marketing_campaigns FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Marketing send log
CREATE TABLE public.marketing_send_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL, -- sent | failed | suppressed
  resend_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_send_log_campaign ON public.marketing_send_log(campaign_id);
ALTER TABLE public.marketing_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view marketing send log"
  ON public.marketing_send_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manage marketing send log"
  ON public.marketing_send_log FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Marketing unsubscribes (separate from transactional suppressed_emails)
CREATE TABLE public.marketing_unsubscribes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  reason TEXT,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view marketing unsubscribes"
  ON public.marketing_unsubscribes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can unsubscribe"
  ON public.marketing_unsubscribes FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Service role manage marketing unsubscribes"
  ON public.marketing_unsubscribes FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Updated_at trigger for campaigns
CREATE TRIGGER trg_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();