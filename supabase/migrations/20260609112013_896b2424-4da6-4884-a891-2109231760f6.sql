CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_discord_new_giveaway()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/discord-notify';
BEGIN
  PERFORM net.http_post(
    url := v_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'channel', 'giveaways',
      'title', '🎁 New Giveaway: ' || COALESCE(NEW.title,'Giveaway'),
      'description', COALESCE(NEW.description, 'Enter now for a chance to win!'),
      'url', 'https://agevers.com/giveaway',
      'image_url', NEW.prize_image_url,
      'content', '@everyone A new giveaway just dropped!',
      'fields', jsonb_build_array(
        jsonb_build_object('name','Prizes','value', COALESCE(NEW.prize_count,1)::text,'inline', true),
        jsonb_build_object('name','Ends','value', COALESCE(to_char(NEW.ends_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI UTC'),'TBA'),'inline', true)
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'discord notify giveaway failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_discord_new_giveaway ON public.giveaways;
CREATE TRIGGER trg_discord_new_giveaway
AFTER INSERT ON public.giveaways
FOR EACH ROW EXECUTE FUNCTION public.notify_discord_new_giveaway();

CREATE OR REPLACE FUNCTION public.notify_discord_new_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/discord-notify';
  v_link text;
BEGIN
  v_link := 'https://agevers.com/product/' || COALESCE(NEW.slug, NEW.id::text);
  PERFORM net.http_post(
    url := v_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'channel', 'products',
      'title', '🆕 ' || NEW.title,
      'description', LEFT(COALESCE(NEW.description_paraphrased, NEW.description, 'Just added to the Agever''s catalog.'), 600),
      'url', v_link,
      'image_url', NEW.image_url,
      'fields', jsonb_build_array(
        jsonb_build_object('name','Platform','value', COALESCE(NEW.platform,'—'),'inline', true),
        jsonb_build_object('name','Region','value', COALESCE(NEW.region,'—'),'inline', true)
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'discord notify product failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_discord_new_product ON public.allowed_products;
CREATE TRIGGER trg_discord_new_product
AFTER INSERT ON public.allowed_products
FOR EACH ROW EXECUTE FUNCTION public.notify_discord_new_product();