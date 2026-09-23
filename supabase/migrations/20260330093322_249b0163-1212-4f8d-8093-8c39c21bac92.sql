
-- Fix security definer view warning - recreate as SECURITY INVOKER
DROP VIEW IF EXISTS public.game_leaderboard_public;

CREATE VIEW public.game_leaderboard_public
WITH (security_invoker = true) AS
SELECT id, username, game_type, score, created_at
FROM public.game_leaderboard;

GRANT SELECT ON public.game_leaderboard_public TO anon, authenticated;

-- Need a policy allowing anon/public to read leaderboard for the view to work
CREATE POLICY "Public can view leaderboard via view"
ON public.game_leaderboard
FOR SELECT
TO anon
USING (true);
