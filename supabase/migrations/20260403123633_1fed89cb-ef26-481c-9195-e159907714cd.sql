
-- Add a timestamp for tracking lock time
ALTER TABLE public.allowed_products ADD COLUMN IF NOT EXISTS paraphrase_locked_at timestamp with time zone;

-- Fix the reset function to use the new column
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
  SET paraphrase_status = 'idle', paraphrase_locked_at = NULL
  WHERE paraphrase_status = 'processing'
    AND paraphrase_locked_at < now() - interval '15 minutes';
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$;
