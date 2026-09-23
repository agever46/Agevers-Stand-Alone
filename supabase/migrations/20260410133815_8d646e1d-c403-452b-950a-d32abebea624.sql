
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
BEGIN
  -- Generate gaming username
  generated_username := gaming_adjectives[1 + floor(random() * array_length(gaming_adjectives, 1))::int]
    || gaming_nouns[1 + floor(random() * array_length(gaming_nouns, 1))::int]
    || '_' || floor(random() * 9000 + 1000)::int;

  -- Pick a happy seed for avatar
  random_seed := happy_seeds[1 + floor(random() * array_length(happy_seeds, 1))::int];

  INSERT INTO public.profiles (user_id, display_name, username, avatar_url, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', generated_username),
    generated_username,
    'https://api.dicebear.com/9.x/fun-emoji/svg?seed=' || random_seed,
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$function$;
