import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type Channel = 'giveaways' | 'products';

interface Payload {
  channel: Channel;
  title: string;
  description?: string;
  url?: string;
  image_url?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  content?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Service-role only — internal server-to-server endpoint.
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!serviceKey || authToken !== serviceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Payload;
    if (!body?.channel || !body?.title) {
      return new Response(JSON.stringify({ error: 'channel and title required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const webhook =
      body.channel === 'giveaways'
        ? Deno.env.get('DISCORD_WEBHOOK_GIVEAWAYS')
        : Deno.env.get('DISCORD_WEBHOOK_PRODUCTS');

    if (!webhook) {
      return new Response(JSON.stringify({ error: `No webhook configured for ${body.channel}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const embed: Record<string, unknown> = {
      title: body.title.slice(0, 250),
      color: body.color ?? (body.channel === 'giveaways' ? 0xf59e0b : 0x3b82f6),
      timestamp: new Date().toISOString(),
      footer: { text: "Agever's" },
    };
    if (body.description) embed.description = body.description.slice(0, 2000);
    if (body.url) embed.url = body.url;
    if (body.image_url) embed.image = { url: body.image_url };
    if (body.fields && body.fields.length > 0) embed.fields = body.fields.slice(0, 10);

    const discordRes = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: body.content,
        embeds: [embed],
        allowed_mentions: { parse: [] },
      }),
    });

    if (!discordRes.ok) {
      const text = await discordRes.text();
      console.error('Discord webhook failed:', discordRes.status, text);
      return new Response(JSON.stringify({ error: 'Discord rejected request', status: discordRes.status, body: text }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('discord-notify error', err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});