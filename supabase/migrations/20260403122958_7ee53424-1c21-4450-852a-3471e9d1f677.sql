
-- Add paraphrase_status column
ALTER TABLE public.allowed_products 
ADD COLUMN IF NOT EXISTS paraphrase_status text NOT NULL DEFAULT 'idle';

-- Set existing paraphrased products to completed
UPDATE public.allowed_products 
SET paraphrase_status = 'completed' 
WHERE description_paraphrased = true;

-- Index for fast cron lookups
CREATE INDEX IF NOT EXISTS idx_allowed_products_paraphrase_status 
ON public.allowed_products (paraphrase_status) 
WHERE paraphrase_status = 'idle';

-- Function to auto-reset stuck "processing" items (>15 min)
CREATE OR REPLACE FUNCTION public.reset_stuck_paraphrasing()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reset_count integer;
BEGIN
  UPDATE allowed_products
  SET paraphrase_status = 'idle'
  WHERE paraphrase_status = 'processing'
    AND updated_at < now() - interval '15 minutes';
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$;
