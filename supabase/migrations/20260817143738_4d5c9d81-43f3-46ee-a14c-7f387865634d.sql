-- Revoke update permission on phone and email_verified columns for authenticated users
-- In PostgreSQL, GRANT is additive. We need to REVOKE the general update and then GRANT only specific columns.

-- 1. First, check current grants and revoke general UPDATE if it exists
REVOKE UPDATE ON public.profiles FROM authenticated;

-- 2. Grant UPDATE only on non-sensitive columns for authenticated users
GRANT UPDATE (display_name, username, address, avatar_url) ON public.profiles TO authenticated;

-- 3. Ensure service_role keeps full access
GRANT ALL ON public.profiles TO service_role;
