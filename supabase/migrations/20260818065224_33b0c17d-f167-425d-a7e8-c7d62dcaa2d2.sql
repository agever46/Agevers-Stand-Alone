
-- Drop the view first to avoid column renaming errors if it already exists with different columns
DROP VIEW IF EXISTS public.public_profiles;

-- 1. Drop the overly permissive public SELECT policy on profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles publicly" ON public.profiles;
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;

-- 2. Ensure only users can see their own full data
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 3. Ensure admins can see everything
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- 4. Re-create public view for non-sensitive info
CREATE VIEW public.public_profiles AS
SELECT 
  id,
  user_id,
  display_name,
  username,
  avatar_url,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT ALL ON public.public_profiles TO service_role;
