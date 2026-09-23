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
  happy_seeds text[] := ARRAY[
    'Felix','Bella','Luna','Sunny','Joy','Lucky','Buddy','Happy','Coco','Milo',
    'Daisy','Peach','Star','Ziggy','Boo','Nala','Leo','Kiki','Pip','Bubbles'
  ];
  generated_username text;
  random_seed text;
  is_oauth boolean;
BEGIN
  generated_username := gaming_adjectives[1 + floor(random() * array_length(gaming_adjectives, 1))::int]
    || gaming_nouns[1 + floor(random() * array_length(gaming_nouns, 1))::int]
    || '_' || floor(random() * 9000 + 1000)::int;

  random_seed := happy_seeds[1 + floor(random() * array_length(happy_seeds, 1))::int];

  -- Detect OAuth signups (Google, Apple, etc.) or pre-confirmed emails
  is_oauth := COALESCE(NEW.raw_app_meta_data->>'provider', 'email') <> 'email'
             OR NEW.email_confirmed_at IS NOT NULL;

  INSERT INTO public.profiles (user_id, display_name, username, avatar_url, phone, email_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', generated_username),
    generated_username,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=' || random_seed),
    NEW.raw_user_meta_data->>'phone',
    is_oauth -- true for Google/Apple, false for email/password
  );
  RETURN NEW;
END;
$function$;

-- Backfill existing Google/OAuth or confirmed users
UPDATE public.profiles p
SET email_verified = true,
    updated_at = now()
FROM auth.users u
WHERE p.user_id = u.id
  AND p.email_verified = false
  AND (COALESCE(u.raw_app_meta_data->>'provider', 'email') <> 'email' OR u.email_confirmed_at IS NOT NULL);