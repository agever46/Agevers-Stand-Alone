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
  gaming_suffixes text[] := ARRAY[
    'X','Pro','Prime','Zero','Max','Core','Edge','Elite','Rush','Vibe',
    'Dash','Byte','Flux','Wave','Echo','Void','Halo','Rift','Surge','Spirit'
  ];
  happy_seeds text[] := ARRAY[
    'Felix','Bella','Luna','Sunny','Joy','Lucky','Buddy','Happy','Coco','Milo',
    'Daisy','Peach','Star','Ziggy','Boo','Nala','Leo','Kiki','Pip','Bubbles'
  ];
  generated_display text;
  base_display text;
  attempt int := 0;
  real_name text;
  random_seed text;
  is_oauth boolean;
BEGIN
  -- Generate a unique gamer-style display name (letters only, no digits)
  LOOP
    base_display := gaming_adjectives[1 + floor(random() * array_length(gaming_adjectives, 1))::int]
      || gaming_nouns[1 + floor(random() * array_length(gaming_nouns, 1))::int];

    IF attempt = 0 THEN
      generated_display := base_display;
    ELSE
      generated_display := base_display
        || gaming_suffixes[1 + floor(random() * array_length(gaming_suffixes, 1))::int];
    END IF;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE display_name = generated_display
    ) OR attempt > 12;

    attempt := attempt + 1;
  END LOOP;

  -- Username = real first + last name provided by the user (or OAuth provider)
  real_name := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', '')),
    NEW.raw_user_meta_data->>'name'
  )), '');

  IF real_name IS NULL THEN
    real_name := split_part(NEW.email, '@', 1);
  END IF;

  random_seed := happy_seeds[1 + floor(random() * array_length(happy_seeds, 1))::int];

  is_oauth := COALESCE(NEW.raw_app_meta_data->>'provider', 'email') <> 'email';

  INSERT INTO public.profiles (user_id, display_name, username, avatar_url, phone, email_verified)
  VALUES (
    NEW.id,
    generated_display,
    real_name,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=' || random_seed),
    NEW.raw_user_meta_data->>'phone',
    is_oauth
  );
  RETURN NEW;
END;
$function$;