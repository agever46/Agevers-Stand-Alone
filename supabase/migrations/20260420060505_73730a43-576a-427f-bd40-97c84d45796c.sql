-- Page views tracking table
CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  page_path text NOT NULL,
  referrer text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON public.page_views(page_path);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Anyone (including guests) can insert their own page view
CREATE POLICY "Anyone can log page views"
ON public.page_views
FOR INSERT
WITH CHECK (true);

-- Only admins can view page views
CREATE POLICY "Admins can view page views"
ON public.page_views
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Aggregation function for top pages
CREATE OR REPLACE FUNCTION public.get_top_pages(_days integer DEFAULT 7, _limit integer DEFAULT 100)
RETURNS TABLE(page_path text, view_count bigint, unique_visitors bigint, last_visit timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pv.page_path,
    COUNT(*) as view_count,
    COUNT(DISTINCT COALESCE(pv.user_id::text, pv.user_agent)) as unique_visitors,
    MAX(pv.created_at) as last_visit
  FROM page_views pv
  WHERE pv.created_at >= now() - (_days || ' days')::interval
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  GROUP BY pv.page_path
  ORDER BY view_count DESC
  LIMIT _limit;
$$;