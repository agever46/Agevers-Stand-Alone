
-- Remove the anon policy on base table - only the view should be public
DROP POLICY IF EXISTS "Public can view leaderboard via view" ON public.game_leaderboard;

-- Instead, create the view as security_invoker=false (definer) owned by a restricted role
-- Actually, simplest approach: just use RLS bypass via security definer function
CREATE OR REPLACE FUNCTION public.get_public_leaderboard(_game_type text DEFAULT NULL, _limit integer DEFAULT 20)
RETURNS TABLE(id uuid, username text, game_type text, score integer, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT gl.id, gl.username, gl.game_type, gl.score, gl.created_at
  FROM public.game_leaderboard gl
  WHERE (_game_type IS NULL OR gl.game_type = _game_type)
  ORDER BY gl.score DESC
  LIMIT _limit;
$$;

-- Drop the view since we'll use the RPC instead
DROP VIEW IF EXISTS public.game_leaderboard_public;
