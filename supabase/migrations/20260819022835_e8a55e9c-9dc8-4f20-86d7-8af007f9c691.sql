CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  gaming_adjectives text[] := ARRAY[
    'Shadow','Neon','Cosmic','Turbo','Hyper','Pixel','Cyber','Storm','Blaze','Thunder',
    'Crystal','Sonic','Quantum','Phantom','Nova','Omega','Alpha','Dragon','Phoenix','Titan',
    'Frost','Venom','Stealth','Mystic','Apex','Crimson','Golden','Silver','Astral','Inferno',
    'Radiant','Epic','Swift','Brave','Stellar','Lunar','Solar','Nitro','Ultra','Mega'
  ];
  gaming_nouns text[] := ARRAY[
    'Wolf','Hawk','Fox','Knight','Ninja','Warrior','Striker','Hunter','Raider','Sniper',
    'Pilot','Rider','Gamer','Ace','Ghost','Sage','Mage','Rogue','Titan','Viper',
    'Eagle','Falcon','Bear','Lion','Shark','Cobra','Panther','Raptor','Phoenix','Dragon',
    'Blade','Shield','Arrow','Bolt','Spark','Flame','Storm','Fury','Force','Star'
  ];
  avatar_styles text[] := ARRAY['fun-emoji', 'adventurer', 'avataaars', 'bottts', 'pixel-art', 'lorelei'];
  generated_username text;
  random_style text;
  random_seed text;
  is_oauth boolean;
BEGIN
  -- Generate random username
  generated_username := gaming_adjectives[1 + floor(random() * array_length(gaming_adjectives, 1))::int]
    || gaming_nouns[1 + floor(random() * array_length(gaming_nouns, 1))::int]
    || '_' || floor(random() * 9000 + 1000)::int;

  -- Select random DiceBear style
  random_style := avatar_styles[1 + floor(random() * array_length(avatar_styles, 1))::int];
  
  -- Generate random seed using MD5 of current time and random number
  random_seed := md5(random()::text || clock_timestamp()::text);

  -- Detect OAuth signups (Google, Apple, Microsoft/Azure, etc.) or pre-confirmed emails
  is_oauth := COALESCE(NEW.raw_app_meta_data->>'provider', 'email') IN ('google', 'apple', 'azure', 'microsoft', 'facebook', 'github')
             OR NEW.email_confirmed_at IS NOT NULL;

  INSERT INTO public.profiles (user_id, display_name, username, avatar_url, phone, email_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', generated_username),
    COALESCE(NEW.raw_user_meta_data->>'username', generated_username),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/9.x/' || random_style || '/svg?seed=' || random_seed),
    NEW.raw_user_meta_data->>'phone',
    is_oauth
  );
  RETURN NEW;
END;
$function$;