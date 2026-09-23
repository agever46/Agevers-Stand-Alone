import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-nowpayments-sig',
};

// Recursively sort object keys (NOWPayments IPN signature spec).
function sortObject(value: any): any {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value).sort()) out[k] = sortObject(value[k]);
    return out;
  }
  return value;
}

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const IPN_SECRET = Deno.env.get('NOWPAYMENTS_IPN_SECRET');
    if (!IPN_SECRET) throw new Error('NOWPAYMENTS_IPN_SECRET not configured');

    const raw = await req.text();
    const sigHeader = req.headers.get('x-nowpayments-sig') || '';

    let payload: any;
    try { payload = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }

    // Verify signature: HMAC-SHA512 of JSON.stringify(sortObject(body))
    const sorted = JSON.stringify(sortObject(payload));
    const expected = await hmacSha512Hex(IPN_SECRET, sorted);
    if (sigHeader.toLowerCase() !== expected.toLowerCase()) {
      console.warn('nowpayments-webhook: signature mismatch', { got: sigHeader, expected });
      return new Response('Invalid signature', { status: 401, headers: corsHeaders });
    }

    const status = String(payload?.payment_status || '').toLowerCase();
    const orderId = String(payload?.order_id || '');
    console.log('nowpayments-webhook', { orderId, status, payment_id: payload?.payment_id });

    if (!orderId.startsWith('np_')) {
      return new Response('Unknown order', { status: 200, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: pending } = await supabase
      .from('pending_paypal_orders')
      .select('*')
      .eq('paypal_order_id', orderId)
      .maybeSingle();
    if (!pending) {
      return new Response('Pending not found', { status: 200, headers: corsHeaders });
    }

    // Always log the latest status snapshot
    await supabase.from('pending_paypal_orders').update({
      last_error: `np_status:${status}`,
    }).eq('id', pending.id);

    // Only fulfill on confirmed completion. NOWPayments terminal success = 'finished'.
    if (status !== 'finished' && status !== 'confirmed') {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // Idempotency guard
    if (pending.status === 'fulfilled') {
      return new Response('already fulfilled', { status: 200, headers: corsHeaders });
    }
    await supabase.from('pending_paypal_orders').update({ status: 'captured' }).eq('id', pending.id);

    // Invoke fulfill-order in internal (service-role) mode.
    const fulfillRes = await fetch(`${SUPABASE_URL}/functions/v1/fulfill-order`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        user_id: pending.user_id,
        paypal_order_id: pending.paypal_order_id,
        items: pending.items,
        redeem_coins: pending.redeem_coins,
        shipping_address: pending.shipping_address || undefined,
        selected_shipping: pending.selected_shipping || undefined,
      }),
    });
    const fulfillJson = await fulfillRes.json().catch(() => ({}));
    if (!fulfillRes.ok || (fulfillJson?.error && !fulfillJson?.success)) {
      await supabase.from('pending_paypal_orders').update({
        status: 'failed', last_error: `Fulfill: ${fulfillJson?.error || fulfillRes.status}`,
      }).eq('id', pending.id);
      return new Response('Fulfillment failed', { status: 500, headers: corsHeaders });
    }

    await supabase.from('pending_paypal_orders').update({
      status: 'fulfilled', fulfilled_at: new Date().toISOString(),
    }).eq('id', pending.id);

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error('nowpayments-webhook error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});