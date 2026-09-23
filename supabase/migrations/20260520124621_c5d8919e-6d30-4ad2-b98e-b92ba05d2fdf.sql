CREATE OR REPLACE FUNCTION public.get_my_block_status()
RETURNS TABLE(is_blocked boolean, reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(fs.is_blocked, false) AS is_blocked,
         COALESCE(fs.notes, '') AS reason
  FROM public.fraud_scores fs
  WHERE fs.user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_block_status() TO authenticated;