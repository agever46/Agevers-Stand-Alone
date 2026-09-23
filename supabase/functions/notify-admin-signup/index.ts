import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Internal-only endpoint: the signup DB trigger (or an internal caller)
  // must present the shared internal token or the service-role key. Without
  // this, anyone could ask the server to look up a user's private account
  // details and push them into admin notifications.
  const INTERNAL_TOKEN = Deno.env.get('INTERNAL_NOTIFY_TOKEN_V3');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const internalHeader = req.headers.get('x-internal-token') || '';
  const authorized =
    (INTERNAL_TOKEN && internalHeader === INTERNAL_TOKEN) ||
    (SERVICE_KEY && bearer === SERVICE_KEY);
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { userId } = body ?? {};
    if (!userId || typeof userId !== 'string') {
      return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Block during maintenance mode — no new signups should be happening; ignore bot noise.
    try {
      const { data: settings } = await supabase.from('site_settings').select('maintenance_mode').eq('id', 1).maybeSingle();
      if (settings?.maintenance_mode) {
        return new Response(JSON.stringify({ ok: false, blocked: 'maintenance' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (_) { /* fail-open */ }

    // Get user from auth
    const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(userId);
    if (userErr || !userResp?.user) {
      console.error('User not found', userErr);
      return new Response(JSON.stringify({ error: 'user not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const user = userResp.user;

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('user_id', userId)
      .maybeSingle();

    // Detect signup method
    const provider = user.app_metadata?.provider || 'email';

    // Only trust an IP/user-agent explicitly supplied by the caller. Request
    // headers here reflect our own infrastructure when called from the DB
    // trigger, which produced wrong geo data — never derive them from headers.
    const ipAddress = typeof body?.ipAddress === 'string' && body.ipAddress.trim()
      ? body.ipAddress.trim()
      : 'unknown';
    const userAgent = typeof body?.userAgent === 'string' && body.userAgent.trim()
      ? body.userAgent.trim()
      : 'unknown';

    let country = '—';
    let city = '—';
    try {
      if (ipAddress && ipAddress !== 'unknown') {
        const geoRes = await fetch(`https://ipapi.co/${ipAddress}/json/`);
        if (geoRes.ok) {
          const geo = await geoRes.json();
          country = geo.country_name || geo.country || '—';
          city = geo.city || '—';
        }
      }
    } catch (e) {
      console.error('GeoIP failed', e);
    }

    // Fraud check is performed at checkout (fraud-check function) — skipped here to save IPQS credits.
    const fraudScore: number | null = null;
    const fraudRiskLevel = 'deferred';
    const fraudNotes = 'Checked at checkout';

    // Send admin email
    const { error: emailErr } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'admin-new-signup',
        recipientEmail: 'admin@agevers.com',
        idempotencyKey: `admin-new-signup-${userId}`,
        templateData: {
          userId,
          email: user.email || 'unknown',
          username: profile?.username || '—',
          displayName: profile?.display_name || '—',
          signupMethod: provider,
          ipAddress,
          country,
          city,
          userAgent,
          fraudScore,
          fraudRiskLevel,
          fraudNotes,
          signedUpAt: user.created_at,
        },
      },
    });

    if (emailErr) console.error('Email send error', emailErr);

    // Telegram alert to admin chat (direct API call — independent of email result)
    try {
      const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const tgChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');
      if (tgToken && tgChatId) {
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const text = `👤 <b>New User Signup</b>\n\n` +
          `• <b>Email</b>: ${esc(user.email || 'unknown')}\n` +
          `• <b>Username</b>: ${esc(profile?.username || '—')}\n` +
          `• <b>Method</b>: ${esc(provider)}\n` +
          `• <b>Location</b>: ${esc(city)}, ${esc(country)}\n` +
          `• <b>IP</b>: ${esc(ipAddress)}\n\n` +
          `<i>Agever's Admin • ${new Date().toISOString()}</i>`;
        const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgChatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        });
        if (!tgRes.ok) console.error('Telegram send failed', tgRes.status, await tgRes.text());
      } else {
        console.error('Telegram secrets missing');
      }
    } catch (e) {
      console.error('Telegram notify error', e);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-admin-signup error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
