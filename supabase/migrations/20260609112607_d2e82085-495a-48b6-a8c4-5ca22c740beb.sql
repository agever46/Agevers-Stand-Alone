CREATE OR REPLACE FUNCTION public.notify_discord_new_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/discord-notify';
  v_link text;
  v_release_year integer;
BEGIN
  -- Only notify for 2026 releases OR Pre-Orders
  v_release_year := EXTRACT(YEAR FROM NEW.release_date)::integer;
  
  IF (
    (v_release_year = 2026 OR NEW.release_date > NOW())
    OR NEW.product_type ILIKE 'Pre-Order%'
  ) THEN
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
          jsonb_build_object('name','Region','value', COALESCE(NEW.region,'—'),'inline', true),
          jsonb_build_object('name','Type','value', COALESCE(NEW.product_type,'—'),'inline', true)
        )
      )
    );
  END IF;
  
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