// Fetches recent updates from Telegram to discover Chat IDs.
// Admin-only utility used to extract the user's personal chat_id.
import { requireAdminOrService } from "../_shared/adminAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authFail = await requireAdminOrService(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 20 }),
    });

    const data = await tgRes.json();
    if (!tgRes.ok) {
      throw new Error(`Telegram getUpdates failed [${tgRes.status}]: ${JSON.stringify(data)}`);
    }

    // Extract unique chats from updates
    const chatsMap = new Map<number, { id: number; type: string; title: string; username?: string; last_message?: string }>();
    for (const u of data.result || []) {
      const msg = u.message || u.edited_message || u.channel_post;
      if (!msg?.chat) continue;
      const c = msg.chat;
      const title = c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || 'Unknown';
      chatsMap.set(c.id, {
        id: c.id,
        type: c.type,
        title,
        username: c.username,
        last_message: msg.text || msg.caption || '(non-text message)',
      });
    }

    const chats = Array.from(chatsMap.values());

    return new Response(JSON.stringify({ success: true, chats, raw_count: data.result?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('telegram-get-chat-id error:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});