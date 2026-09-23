
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- Update the handle_new_user function to not set display_name to email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.raw_user_meta_data->>'username'
  );
  RETURN NEW;
END;
$$;
