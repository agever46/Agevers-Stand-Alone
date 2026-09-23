
-- 1. Restrict giveaways: remove broad public SELECT, expose safe columns via RPC/view
DROP POLICY IF EXISTS "Anyone can view giveaways" ON public.giveaways;

CREATE POLICY "Admins can view all giveaways"
ON public.giveaways FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Winners can view their own giveaway"
ON public.giveaways FOR SELECT
TO authenticated
USING (winner_user_id = auth.uid());

-- Safe public RPCs
CREATE OR REPLACE FUNCTION public.get_public_active_giveaway()
RETURNS TABLE(
  id uuid, title text, description text, status text,
  starts_at timestamptz, ends_at timestamptz,
  prize_image_url text, prize_count integer,
  allowed_product_id uuid, fake_entries_boost integer,
  winner_announced_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, title, description, status, starts_at, ends_at,
         prize_image_url, prize_count, allowed_product_id,
         fake_entries_boost, winner_announced_at
  FROM public.giveaways
  WHERE status = 'active'
  ORDER BY ends_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_past_winners(_limit integer DEFAULT 5)
RETURNS TABLE(
  id uuid, title text, prize_image_url text,
  winner_announced_at timestamptz, ends_at timestamptz,
  winner_display text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, title, prize_image_url, winner_announced_at, ends_at,
    CASE
      WHEN winner_email IS NULL THEN NULL
      ELSE LEFT(split_part(winner_email,'@',1), 3) || '***@' || split_part(winner_email,'@',2)
    END as winner_display
  FROM public.giveaways
  WHERE status = 'drawn'
  ORDER BY winner_announced_at DESC NULLS LAST
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_active_giveaway() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_past_winners(integer) TO anon, authenticated;

-- 2. Restrict giveaway_entries: remove public PII exposure
DROP POLICY IF EXISTS "Public count visibility" ON public.giveaway_entries;

CREATE OR REPLACE FUNCTION public.get_giveaway_entry_stats(_giveaway_id uuid)
RETURNS TABLE(participant_count bigint, total_entries bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::bigint, COALESCE(SUM(entry_count),0)::bigint
  FROM public.giveaway_entries
  WHERE giveaway_id = _giveaway_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_giveaway_entry_stats(uuid) TO anon, authenticated;

-- 3. Fix avatars bucket: enforce ownership on UPDATE/DELETE based on folder = uid
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Also tighten the insert policy to enforce path = uid
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
