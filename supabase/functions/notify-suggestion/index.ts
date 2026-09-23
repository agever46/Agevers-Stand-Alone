// Public endpoint: sends a Telegram alert to the admin chat when a new
// customer suggestion / bug report / feature request is submitted from
// the public Suggestion Mailbox page. No auth required (verify_jwt = false).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Block during maintenance mode (site closed to public) to stop bot spam.
    const { data: settings, error: settingsError } = await supa
      .from('site_settings')
      .select('maintenance_mode')
      .eq('id', 1)
      .maybeSingle();

    if (settingsError || settings?.maintenance_mode !== false) {
      return new Response(JSON.stringify({ ok: false, blocked: 'maintenance' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const CHAT_ID = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');
    if (!TELEGRAM_BOT_TOKEN || !CHAT_ID) {
      return new Response(JSON.stringify({ ok: false, error: 'telegram not configured' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const suggestionId = typeof body?.suggestionId === 'string' ? body.suggestionId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(suggestionId)) {
      return new Response(JSON.stringify({ ok: false, ignored: 'missing_suggestion' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: suggestion, error: suggestionError } = await supa
      .from('customer_suggestions')
      .select('email, type, subject, message, created_at')
      .eq('id', suggestionId)
      .gte('created_at', fiveMinutesAgo)
      .maybeSingle();

    if (suggestionError || !suggestion) {
      return new Response(JSON.stringify({ ok: false, ignored: 'missing_suggestion' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const type = String(suggestion.type || 'other');
    const subject = String(suggestion.subject || '(no subject)').slice(0, 200);
    const message = String(suggestion.message || '').slice(0, 1500);
    const email = String(suggestion.email || 'anonymous').slice(0, 200);

    const labels: Record<string, string> = {
      product_request: '📦 Product Request',
      bug_report: '🐞 Bug Report',
      feature_request: '💡 Feature Request',
      other: '✉️ Suggestion',
    };
    const label = labels[type] || labels.other;

    const text =
      `🔔 <b>New ${escapeHtml(label)}</b>\n\n` +
      `<b>Subject:</b> ${escapeHtml(subject)}\n` +
      `<b>From:</b> ${escapeHtml(email)}\n\n` +
      `${escapeHtml(message)}\n\n` +
      `<i>Agever's Mailbox • ${new Date().toISOString()}</i>`;

    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data = await tgRes.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: tgRes.ok, data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('notify-suggestion error:', msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});