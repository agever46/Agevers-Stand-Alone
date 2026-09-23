
DROP POLICY IF EXISTS "Anyone can submit affiliate application" ON public.affiliate_applications;
CREATE POLICY "Anyone can submit affiliate application"
ON public.affiliate_applications FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(full_name)) BETWEEN 2 AND 100
  AND length(email) <= 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
  AND length(btrim(primary_niche)) BETWEEN 1 AND 100
  AND length(btrim(follower_count)) BETWEEN 1 AND 50
  AND length(btrim(promotion_plan)) BETWEEN 10 AND 5000
  AND coalesce(length(instagram_handle), 0) <= 200
  AND coalesce(length(tiktok_handle), 0) <= 200
  AND coalesce(length(youtube_handle), 0) <= 200
);

DROP POLICY IF EXISTS "Anyone can submit wholesale inquiry" ON public.wholesale_inquiries;
CREATE POLICY "Anyone can submit wholesale inquiry"
ON public.wholesale_inquiries FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(company_name)) BETWEEN 2 AND 200
  AND length(contact_email) <= 255 AND contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
  AND length(btrim(business_address)) BETWEEN 5 AND 500
  AND length(btrim(sales_channels)) BETWEEN 2 AND 500
  AND length(btrim(monthly_order_volume)) BETWEEN 1 AND 100
  AND coalesce(length(tax_id), 0) <= 100
  AND coalesce(length(website_url), 0) <= 500
);

DROP POLICY IF EXISTS "Anyone can submit partnership proposal" ON public.partnership_proposals;
CREATE POLICY "Anyone can submit partnership proposal"
ON public.partnership_proposals FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(representative_name)) BETWEEN 2 AND 100
  AND length(email) <= 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
  AND length(btrim(job_title)) BETWEEN 2 AND 100
  AND length(btrim(company_industry)) BETWEEN 2 AND 100
  AND length(btrim(proposal)) BETWEEN 10 AND 5000
  AND coalesce(array_length(strategic_goals, 1), 0) <= 20
);

DROP POLICY IF EXISTS "Anyone can submit an opt-out request" ON public.privacy_opt_out;
CREATE POLICY "Anyone can submit an opt-out request"
ON public.privacy_opt_out FOR INSERT TO anon, authenticated
WITH CHECK (
  length(email) <= 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
  AND length(btrim(source)) BETWEEN 1 AND 50
  AND coalesce(length(note), 0) <= 2000
  AND (user_id IS NULL OR user_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can submit a contact message" ON public.contact_messages;
CREATE POLICY "Anyone can submit a contact message"
ON public.contact_messages FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(name)) BETWEEN 2 AND 100
  AND length(email) <= 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
  AND length(btrim(message)) BETWEEN 10 AND 2000
);

DROP POLICY IF EXISTS "Anyone can unsubscribe" ON public.marketing_unsubscribes;
CREATE POLICY "Anyone can unsubscribe"
ON public.marketing_unsubscribes FOR INSERT TO anon, authenticated
WITH CHECK (
  length(email) <= 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
  AND coalesce(length(reason), 0) <= 1000
);

DROP POLICY IF EXISTS "Anyone can record their consent choice" ON public.cookie_consent_logs;
CREATE POLICY "Anyone can record their consent choice"
ON public.cookie_consent_logs FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(choice)) BETWEEN 1 AND 50
  AND coalesce(length(user_agent), 0) <= 1000
);

DROP POLICY IF EXISTS "Anyone can log page views" ON public.page_views;
CREATE POLICY "Anyone can log page views"
ON public.page_views FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(page_path)) BETWEEN 1 AND 500
  AND coalesce(length(referrer), 0) <= 1000
  AND coalesce(length(user_agent), 0) <= 1000
  AND (user_id IS NULL OR user_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can insert search logs" ON public.search_logs;
CREATE POLICY "Anyone can insert search logs"
ON public.search_logs FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(query)) BETWEEN 1 AND 200
  AND results_count >= 0
  AND coalesce(length(page_path), 0) <= 500
  AND coalesce(length(user_agent), 0) <= 1000
  AND (user_id IS NULL OR user_id = auth.uid())
);

DROP POLICY IF EXISTS "Guests can upload ticket screenshots" ON storage.objects;
