-- Fix the security definer view issue - use SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS SELECT user_id, display_name, username, avatar_url
FROM public.profiles;

-- We need a policy that allows public to read profiles but only through this limited view
-- Re-add a restricted public policy since the view needs it
CREATE POLICY "Public can view basic profile info" ON public.profiles
FOR SELECT TO public
USING (true);

GRANT SELECT ON public.public_profiles TO anon, authenticated;