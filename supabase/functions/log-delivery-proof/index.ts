import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');

    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error('Not authenticated');

    const { order_id, device_fingerprint, terms_accepted } = await req.json();
    if (!order_id) throw new Error('Missing order_id');

    // Verify order belongs to user
    const { data: order } = await supabase
      .from('orders')
      .select('id, user_id, game_code, game_title')
      .eq('id', order_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!order) throw new Error('Order not found');

    // Check if already logged
    const { data: existing } = await supabase
      .from('delivery_proof_logs')
      .select('id')
      .eq('order_id', order_id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ logged: true, already_exists: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Capture IP and geo
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    let country: string | null = null;
    let city: string | null = null;
    // Prefer Cloudflare's TLS-secured cf-ipcountry header; fall back to an
    // HTTPS geo provider so plaintext HTTP can't be MITM'd.
    const cfCountryHeader = (req.headers.get('cf-ipcountry') || '').toUpperCase();
    if (cfCountryHeader && cfCountryHeader !== 'XX' && cfCountryHeader !== 'T1') {
      country = cfCountryHeader;
    }
    if (clientIp && clientIp !== 'unknown') {
      try {
        const geoRes = await fetch(`https://ipwho.is/${encodeURIComponent(clientIp)}?fields=success,country_code,country,city`, {
          signal: AbortSignal.timeout(3000),
        });
        if (geoRes.ok) {
          const geo = await geoRes.json();
          if (geo?.success !== false) {
            country = country || geo.country_code || geo.country || null;
            city = geo.city || null;
          }
        }
      } catch { /* ignore */ }
    }

    // Get buyer profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('user_id', user.id)
      .maybeSingle();

    // Insert delivery proof log
    await supabase.from('delivery_proof_logs').insert({
      order_id,
      user_id: user.id,
      ip_address: clientIp,
      user_agent: userAgent,
      country,
      city,
      device_fingerprint: device_fingerprint || null,
      email: user.email || null,
      phone: profile?.phone || null,
      terms_accepted: !!terms_accepted,
      metadata: {
        email_confirmed: !!user.email_confirmed_at,
        account_created_at: user.created_at,
      },
    });

    // Also mark order as viewed
    await supabase
      .from('orders')
      .update({ codes_viewed: true, code_viewed_at: new Date().toISOString() })
      .eq('id', order_id)
      .eq('user_id', user.id);

    // Send backup "code viewed" email as paper trail
    if (user.email) {
      try {
        const viewedAt = new Date().toISOString();
        
        // Call send-transactional-email directly (service-to-service)
        const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_name: 'code-viewed-confirmation',
            recipient_email: user.email,
            templateData: {
              game_title: order.game_title || 'your order',
              order_id,
              viewed_at: viewedAt,
              ip_address: clientIp,
              country: country || 'Unknown',
              city: city || 'Unknown',
            },
          }),
        });
        console.log(`Backup code-viewed email sent: status=${emailRes.status}, order=${order_id}`);
      } catch (emailErr) {
        console.error('Failed to send backup email:', emailErr);
      }
    }

    console.log(`Delivery proof logged: order=${order_id}, user=${user.id}, ip=${clientIp}, country=${country}`);

    return new Response(JSON.stringify({ logged: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delivery proof error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
