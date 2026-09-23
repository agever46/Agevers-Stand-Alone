// Cron monitor: scans pending_paypal_orders that are stuck in `created` for > 10min
// (meaning PayPal was approved but paypal-capture-order was never called or failed
// silently). Sends a Telegram alert so admin can investigate immediately.
//
// Intended to be invoked every 15 minutes via pg_cron.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireServiceOrInternal } from '../_shared/adminAuth.ts';

const STUCK_MINUTES = 10;

async function getPaypalToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const secret = Deno.env.get('PAYPAL_SECRET');
  if (!clientId || !secret) throw new Error('PayPal not configured');
  const isLive = Deno.env.get('PAYPAL_LIVE')?.toLowerCase() === 'true';
  const baseUrl = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${btoa(`${clientId}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('PayPal auth failed');
  return { token: json.access_token, baseUrl };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // Restrict to trusted scheduled/internal callers. The shared guard accepts
    // a gateway-verified service-role JWT even during managed key transitions.
    const authFail = await requireServiceOrInternal(req, corsHeaders);
    if (authFail) return authFail;
    const supabase = createClient(SUPABASE_URL, SERVICE);

    const cutoff = new Date(Date.now() - STUCK_MINUTES * 60_000).toISOString();

    // Stuck = still in `created` (never captured) or `captured` (captured but not fulfilled)
    // and older than cutoff. Excludes fulfilled/failed/expired terminal states.
    // No upper age bound: a row that ages out of this query before ever being
    // classified would sit in `created`/`captured` (shown as "Pending" in the
    // admin panel) forever, since nothing else ever revisits it. Every stuck
    // row gets classified via PayPal's own order status every run, however
    // old — most very old ones simply come back 404/VOIDED and get marked
    // `expired` below, same as a fresh one would.
    const { data: stuck, error } = await supabase
      .from('pending_paypal_orders')
      .select('id, paypal_order_id, user_email, guest_email, total_charge, charge_currency, status, created_at, updated_at, last_error')
      .in('status', ['created', 'captured'])
      .lt('updated_at', cutoff)
      // Oldest first: with no age ceiling, a large pre-existing backlog must
      // not be starved forever by a steady stream of newer stuck orders.
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw new Error(error.message);

    if (!stuck || stuck.length === 0) {
      return new Response(JSON.stringify({ ok: true, stuck: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Query PayPal for each candidate to classify:
    //   APPROVED → real problem (buyer paid, capture missing)
    //   CREATED/SAVED/PAYER_ACTION_REQUIRED → buyer abandoned, not a bug
    //   COMPLETED → already captured on PayPal side (we missed the webhook)
    //   VOIDED / 404 → dead, mark expired
    let ppAuth: { token: string; baseUrl: string } | null = null;
    try { ppAuth = await getPaypalToken(); } catch (e) { console.error('paypal auth failed', e); }

    const realProblems: typeof stuck = [];
    const abandoned: string[] = [];
    const alreadyCompleted: string[] = [];
    const dead: string[] = [];

    for (const row of stuck) {
      if (!ppAuth) { realProblems.push(row); continue; }
      try {
        const r = await fetch(`${ppAuth.baseUrl}/v2/checkout/orders/${row.paypal_order_id}`, {
          headers: { 'Authorization': `Bearer ${ppAuth.token}` },
        });
        if (r.status === 404) { dead.push(row.paypal_order_id); continue; }
        const j = await r.json();
        const s = String(j?.status || '').toUpperCase();
        if (s === 'APPROVED') {
          realProblems.push(row); // buyer paid, we didn't capture → alert
        } else if (s === 'COMPLETED') {
          alreadyCompleted.push(row.paypal_order_id);
        } else if (s === 'VOIDED') {
          dead.push(row.paypal_order_id);
        } else {
          // CREATED / SAVED / PAYER_ACTION_REQUIRED → buyer never finished
          abandoned.push(row.paypal_order_id);
        }
      } catch (e) {
        console.error('paypal status check failed for', row.paypal_order_id, e);
        // On unknown failure, be conservative and alert
        realProblems.push(row);
      }
    }

    // Update terminal states silently
    if (abandoned.length) {
      await supabase.from('pending_paypal_orders')
        .update({ status: 'expired', last_error: '[auto: buyer abandoned on PayPal]' })
        .in('paypal_order_id', abandoned);
    }
    if (dead.length) {
      await supabase.from('pending_paypal_orders')
        .update({ status: 'expired', last_error: '[auto: PayPal order voided/expired]' })
        .in('paypal_order_id', dead);
    }
    if (alreadyCompleted.length) {
      // Captured on PayPal but our fulfill never ran — this IS a real problem, but different signature
      await supabase.from('pending_paypal_orders')
        .update({ status: 'captured', last_error: '[auto: found COMPLETED on PayPal, fulfill missing]' })
        .in('paypal_order_id', alreadyCompleted);
    }

    const count = realProblems.length + alreadyCompleted.length;
    if (count === 0) {
      return new Response(JSON.stringify({
        ok: true, stuck: 0, abandoned: abandoned.length, dead: dead.length,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const alertRows = [...realProblems];
    const totalValue = alertRows.reduce((s, r) => s + Number(r.total_charge || 0), 0);
    const currency = alertRows[0]?.charge_currency || 'EUR';
    const sample = alertRows.slice(0, 5).map((r) =>
      `• ${r.paypal_order_id} (${r.status}) ${r.charge_currency || ''}${r.total_charge || 0} — ${r.user_email || r.guest_email || 'guest'}`
    ).join('\n');

    const message =
      `${realProblems.length} PayPal order(s) APPROVED by buyer but capture never completed. ` +
      `${alreadyCompleted.length} already COMPLETED on PayPal but not fulfilled locally.\n\n` +
      `Ignored (buyer abandoned): ${abandoned.length}\n` +
      `Ignored (expired/voided): ${dead.length}\n` +
      `Est. value at risk: ${currency} ${totalValue.toFixed(2)}\n\n` +
      `Real problems:\n${sample || '(none — only missing fulfillments)'}`;

    // See paypal-capture-order: sending only the pre-rotation token silently
    // 401'd every alert. Send both accepted credentials and log failures.
    const TOK = Deno.env.get('INTERNAL_NOTIFY_TOKEN_V3') || '';
    const tgRes = await fetch(`${SUPABASE_URL}/functions/v1/telegram-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': TOK,
        'Authorization': `Bearer ${SERVICE}`,
      },
      body: JSON.stringify({
        type: 'fraud',
        title: `🚨 ${count} PayPal Order${count > 1 ? 's' : ''} Need Attention`,
        message,
        meta: { real_problems: realProblems.length, already_completed: alreadyCompleted.length, abandoned: abandoned.length, dead: dead.length, value: totalValue, currency },
      }),
    }).catch((e) => { console.error('telegram-notify threw', e); return null; });
    if (tgRes && !tgRes.ok) console.error('telegram-notify failed', tgRes.status, await tgRes.text().catch(() => ''));

    return new Response(JSON.stringify({
      ok: true, real_problems: realProblems.length, already_completed: alreadyCompleted.length,
      abandoned: abandoned.length, dead: dead.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('paypal-stuck-orders-monitor error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});