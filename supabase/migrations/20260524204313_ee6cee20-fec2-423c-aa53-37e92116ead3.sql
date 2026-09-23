CREATE OR REPLACE FUNCTION public.is_giveaway_open(_giveaway_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.giveaways g
    WHERE g.id = _giveaway_id
      AND g.status = 'active'
      AND now() >= g.starts_at
      AND now() <= g.ends_at
  );
$$;

DROP POLICY IF EXISTS "Users can join giveaways" ON public.giveaway_entries;

CREATE POLICY "Users can join giveaways"
ON public.giveaway_entries
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND entry_count = 1
  AND bonus_from_orders = 0
  AND public.is_giveaway_open(giveaway_id)
);