DO $$
DECLARE
  v_campaign_id uuid := gen_random_uuid();
  v_service_key text;
  v_html text;
BEGIN
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  v_html := '<div style="text-align:center;padding:24px 0">'
    || '<h1 style="font-size:30px;margin:0 0 8px;color:#0f172a">🎁 Win a Free Game Key</h1>'
    || '<p style="font-size:16px;color:#475569;margin:0 0 4px">A new Agever''s giveaway just dropped.</p>'
    || '<p style="font-size:14px;color:#64748b;margin:0 0 24px">Free to enter. The more you shop, the higher your chances.</p>'
    || '<div style="background:#0f172a;border-radius:14px;padding:24px;color:#fff;margin:0 0 24px">'
    || '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#fbbf24;margin-bottom:6px">Current Prize</div>'
    || '<div style="font-size:22px;font-weight:bold;margin-bottom:6px">Guardians of Dao</div>'
    || '<div style="font-size:13px;color:#cbd5e1">PC · Steam · Global</div>'
    || '<img src="https://static.kinguin.net/media/images/products/000_202603160809_GuardiansofDao111.jpg" alt="Guardians of Dao" style="max-width:240px;width:100%;margin:18px auto 0;border-radius:8px;display:block" />'
    || '</div>'
    || '<a href="https://agevers.com/giveaway" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px">Enter for Free →</a>'
    || '<p style="font-size:13px;color:#64748b;margin:28px 0 0;line-height:1.6">⏰ Drawing on <strong>May 15, 2026</strong><br/>'
    || '🛍️ Every order during the giveaway adds <strong>+1 bonus entry</strong>, automatically.<br/>'
    || '🏆 Winner picked at random &amp; notified by email.</p>'
    || '</div>';

  INSERT INTO public.marketing_campaigns (
    id, subject, html_content, preview_text, from_name, from_email,
    status, recipient_filter
  ) VALUES (
    v_campaign_id,
    '🎁 New giveaway is live — Win Guardians of Dao for free',
    v_html,
    'A new Agever''s giveaway just dropped — enter free, boost your odds with every order.',
    'Agever''s',
    'marketing@updates.agevers.com',
    'draft',
    '{"mode":"all_subscribers"}'::jsonb
  );

  PERFORM net.http_post(
    url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/send-marketing-campaign',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('campaignId', v_campaign_id)
  );
END $$;