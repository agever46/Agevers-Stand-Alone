CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.raw_user_meta_data->>'username',
    'https://api.dicebear.com/9.x/fun-emoji/svg?seed=' || NEW.id
  );
  RETURN NEW;
END;
$$;