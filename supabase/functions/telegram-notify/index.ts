// Sends an alert to the admin Telegram chat.
// Invoked from other edge functions (large orders, fraud, stock failures, chargebacks)
// or from admin-only tooling. Callers must present the service-role key OR an admin JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyBody {
  type: 'large_order' | 'fraud' | 'stock' | 'chargeback' | 'test' | string;
  title: string;
  message: string;
  meta?: Record<string, unknown>;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function emojiFor(type: string) {
  switch (type) {
    case 'large_order': return '💰';
    case 'fraud': return '🚨';
    case 'stock': return '📦';
    case 'chargeback': return '⚠️';
    case 'gift': return '🎁';
    case 'cron': return '🩺';
    case 'test': return '🧪';
    default: return '🔔';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Authorization: service-role OR authenticated admin/super_admin only.
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    // Rotated token: only V3 is accepted (V1/V2 are revoked).
    const INTERNAL_TOKEN = Deno.env.get('INTERNAL_NOTIFY_TOKEN_V3');
    const INTERNAL_TOKEN_V2 = undefined as string | undefined;
    const internalHeader = req.headers.get('x-internal-token') || '';
    const authToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const isInternal = !!internalHeader &&
      ((!!INTERNAL_TOKEN && internalHeader === INTERNAL_TOKEN) ||
       (!!INTERNAL_TOKEN_V2 && internalHeader === INTERNAL_TOKEN_V2));
    if (!isInternal && (!SERVICE_KEY || !SUPABASE_URL || !authToken)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!isInternal && authToken !== SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: { user }, error: authErr } = await supabase.auth.getUser(authToken);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      const isAdmin = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin');
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const CHAT_ID = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');
    if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    if (!CHAT_ID) throw new Error('TELEGRAM_ADMIN_CHAT_ID is not configured');

    const body = (await req.json()) as NotifyBody;
    if (!body?.title || !body?.message) {
      return new Response(JSON.stringify({ error: 'title and message are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emoji = emojiFor(body.type || 'default');
    let text = `${emoji} <b>${escapeHtml(body.title)}</b>\n\n${escapeHtml(body.message)}`;
    if (body.meta && Object.keys(body.meta).length > 0) {
      const metaLines = Object.entries(body.meta)
        .map(([k, v]) => `• <b>${escapeHtml(k)}</b>: ${escapeHtml(String(v))}`)
        .join('\n');
      text += `\n\n${metaLines}`;
    }
    text += `\n\n<i>Agever's Admin • ${new Date().toISOString()}</i>`;

    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await tgRes.json();
    if (!tgRes.ok) {
      throw new Error(`Telegram sendMessage failed [${tgRes.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, message_id: data.result?.message_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('telegram-notify error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
