// Daily PayPal credential health check.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// See paypal-capture-order: sending only the pre-rotation token silently
// 401'd every alert. Send both accepted credentials and log failures.
async function notify(title: string, message: string, meta: Record<string, unknown>) {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const INTERNAL_TOKEN = Deno.env.get('INTERNAL_NOTIFY_TOKEN_V3') || '';
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': INTERNAL_TOKEN,
        'Authorization': `Bearer ${SERVICE}`,
      },
      body: JSON.stringify({ type: 'fraud', title, message, meta }),
    });
    if (!res.ok) console.error('notify failed', res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.error('notify failed', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Restrict to service-role callers (pg_cron / admin tooling). Blocks
  // public invocation that would spam PayPal + Telegram from the outside.
  const authToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (authToken !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Auth-only canary probe used by cron-health-monitor: confirms the
  // service-role header still works without calling PayPal for real.
  if (new URL(req.url).searchParams.get('healthCheckOnly') === '1') {
    return new Response(JSON.stringify({ ok: true, healthCheck: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const secret = Deno.env.get('PAYPAL_SECRET');
  const isLive = Deno.env.get('PAYPAL_LIVE')?.toLowerCase() === 'true';
  const baseUrl = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

  if (!clientId || !secret) {
    await notify('🚨 PayPal Health Check FAILED', 'PAYPAL_CLIENT_ID or PAYPAL_SECRET is missing', {});
    return new Response(JSON.stringify({ ok: false, error: 'missing_creds' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${clientId}:${secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    await notify(
      '🚨 PayPal OAuth FAILED',
      `PayPal rejected credentials (HTTP ${tokenRes.status}). PAYPAL_CLIENT_ID / PAYPAL_SECRET pair is invalid. Buyers cannot complete payment until fixed.`,
      { status: tokenRes.status, error: tokenJson },
    );
    return new Response(JSON.stringify({ ok: false, stage: 'oauth' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Synthetic round-trip: create a tiny test order and immediately fetch it.
  // If create succeeds but fetch returns 404 → creds are split between two merchants
  // (server-side OAuth uses one account, but somehow create writes under another).
  // An unapproved order is auto-voided by PayPal after 3 hours, so no cleanup needed.
  let drift = false;
  let lastError: unknown = null;
  const createRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenJson.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'EUR', value: '1.00' },
        description: 'Agevers health check (do not pay)',
      }],
    }),
  });
  const createJson = await createRes.json();
  const testOrderId = createJson?.id;

  if (!createRes.ok || !testOrderId) {
    await notify(
      '🚨 PayPal Create FAILED',
      `Could not create a test order (HTTP ${createRes.status}). New buyers cannot start checkout.`,
      { error: createJson },
    );
    return new Response(JSON.stringify({ ok: false, stage: 'create', error: createJson }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const lookupRes = await fetch(`${baseUrl}/v2/checkout/orders/${testOrderId}`, {
    headers: { 'Authorization': `Bearer ${tokenJson.access_token}` },
  });
  if (lookupRes.status === 404) {
    drift = true;
    lastError = await lookupRes.json().catch(() => null);
  }

  if (drift) {
    await notify(
      '🚨 PayPal Credentials MISMATCH',
      `Test order ${testOrderId} was created but cannot be fetched. PAYPAL_CLIENT_ID/SECRET are split between two merchant accounts. Buyers cannot complete payment. Update PAYPAL_CLIENT_ID + PAYPAL_SECRET in Project Secrets.`,
      { error: lastError, clientIdPrefix: clientId.slice(0, 10) },
    );
  }

  return new Response(JSON.stringify({ ok: !drift, drift, testOrderId }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
