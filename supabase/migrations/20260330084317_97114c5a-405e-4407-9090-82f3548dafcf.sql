
-- Remove the broad seller UPDATE policy
DROP POLICY IF EXISTS "Sellers can update seller_seen on own withdrawals" ON public.withdrawal_requests;

-- Create secure RPC that only marks withdrawal as seen
CREATE OR REPLACE FUNCTION public.mark_withdrawal_seen(_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE withdrawal_requests
  SET seller_seen = true
  WHERE id = _withdrawal_id
    AND seller_id = auth.uid();
END;
$$;
