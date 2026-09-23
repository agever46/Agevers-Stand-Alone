-- Remove the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view public profile fields" ON public.profiles;

-- Create a secure view for public profile data (only non-sensitive fields)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT user_id, display_name, username, avatar_url
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Keep authenticated users able to see their own full profile
-- (already handled by "Users can view their own profile" policy)