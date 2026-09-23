
CREATE TABLE public.search_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert search logs"
ON public.search_logs
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Admins can view search logs"
ON public.search_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_search_logs_query ON public.search_logs (query);
CREATE INDEX idx_search_logs_created_at ON public.search_logs (created_at DESC);
CREATE INDEX idx_search_logs_results_count ON public.search_logs (results_count);
