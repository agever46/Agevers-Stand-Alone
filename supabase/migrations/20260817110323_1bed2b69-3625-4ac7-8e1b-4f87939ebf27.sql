CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  gamer_adjectives text[] := ARRAY['Epic', 'Pro', 'Elite', 'Legendary', 'Mega', 'Hyper', 'Super', 'Ultra', 'Gamer', 'Master', 'Shadow', 'Neon', 'Golden', 'Stealth', 'Ace', 'Alpha', 'Delta', 'Zero', 'Cyborg', 'Pixel'];
  gamer_nouns text[] := ARRAY['Wolf', 'Hunter', 'Blade', 'Hero', 'Knight', 'Titan', 'Warrior', 'Ninja', 'Pilot', 'Striker', 'Ghost', 'Vortex', 'Slayer', 'Dragon', 'Rex', 'Cyber', 'Droid', 'Phantom', 'Sniper', 'Scout'];
  random_adj text;
  random_noun text;
  generated_display_name text;
  is_oauth boolean;
BEGIN
  -- Select random adjective and noun
  random_adj := gamer_adjectives[1 + floor(random() * array_length(gamer_adjectives, 1))];
  random_noun := gamer_nouns[1 + floor(random() * array_length(gamer_nouns, 1))];
  
  -- Combine into a gamer-style name
  generated_display_name := random_adj || random_noun;

  -- Check if user is signing up via OAuth (Google/Apple/etc)
  is_oauth := (NEW.raw_app_meta_data->>'provider' IN ('google', 'apple', 'facebook', 'github', 'discord', 'twitter'));

  INSERT INTO public.profiles (user_id, display_name, username, avatar_url, phone, email_verified)
  VALUES (
    NEW.id,
    -- Prioritize Google/Apple names, then fallback to generated gamer name
    COALESCE(NEW.raw_user_meta_data->>'full_name', generated_display_name),
    -- Username remains as provided in metadata or null
    NEW.raw_user_meta_data->>'username',
    -- Use 'fun-emoji' with a smiley face seed
    'https://api.dicebear.com/9.x/fun-emoji/svg?seed=happy',
    NEW.raw_user_meta_data->>'phone',
    -- Automatically verify email for OAuth users
    COALESCE(is_oauth, false)
  );
  RETURN NEW;
END;
$function$;