// Watches for payment breakage that the existing monitors structurally miss.
//
// Why this exists: in Aug-Sep 2026 guest card payments failed for 10 days
// straight (PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING) with zero alerts and
// thousands of euros in lost orders, because:
//   * paypal-stuck-orders-monitor asks PayPal for each stuck order's status
//     and treats CREATED as "buyer abandoned, not a bug" — but a rejected
//     card leaves the order in exactly that state, so it silently expired
//     every single failure.
//   * paypal-health-check only creates a synthetic order, and creating an
//     order needs no card-processing capability — so it stayed green.
//
// Two signals, both cheap (one query each, no PayPal API calls):
//   A. Payee/account-level errors in last_error. These are never normal —
//      they mean the merchant account itself can't take the money.
//   B. Volume with zero conversion: enough attempts in the window and not a
//      single fulfilment. This catches breakage whose error text we've never
//      seen before, which is what would have caught the outage on day one.
//      Threshold checked against real history: quiet days here run 1-6
//      attempts, and every day of the outage cleared 6 easily.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Errors that always mean "the merchant account cannot accept this payment".
const FATAL_PAYEE_ISSUES = [
  'PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING',
  'PAYEE_ACCOUNT_RESTRICTED',
  'PAYEE_ACCOUNT_LOCKED_OR_CLOSED',
  'PAYEE_ACCOUNT_INVALID',
  'PAYEE_BLOCKED_TRANSACTION',
  'TRANSACTION_REFUSED',
  'COMPLIANCE_VIOLATION',
];

const WINDOW_HOURS = 6;
const MIN_ATTEMPTS_FOR_ZERO_CONVERSION = 6;
const RE_ALERT_AFTER_HOURS = 12;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (authToken !== SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();

    const { data: rows, error } = await supabase
      .from('pending_paypal_orders')
      .select('status, last_error, total_charge, charge_currency, created_at')
      .gt('created_at', since);
    if (error) throw error;

    const attempts = rows || [];
    const fulfilled = attempts.filter((r: any) => r.status === 'fulfilled').length;

    // Signal A — payee/account-level failures.
    const fatalIssues = new Set<string>();
    for (const r of attempts) {
      const err = String(r.last_error || '').toUpperCase();
      for (const issue of FATAL_PAYEE_ISSUES) {
        if (err.includes(issue)) fatalIssues.add(issue);
      }
    }

    // Signal B — real volume, zero conversion.
    const zeroConversion =
      attempts.length >= MIN_ATTEMPTS_FOR_ZERO_CONVERSION && fulfilled === 0;

    if (fatalIssues.size === 0 && !zeroConversion) {
      return new Response(JSON.stringify({ ok: true, attempts: attempts.length, fulfilled, alerted: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Don't re-alert about the same thing every hour while it's being worked on.
    const signature = fatalIssues.size > 0
      ? `fatal:${[...fatalIssues].sort().join(',')}`
      : 'zero_conversion';
    const dedupeSince = new Date(Date.now() - RE_ALERT_AFTER_HOURS * 3600_000).toISOString();
    const { data: recent } = await supabase
      .from('payment_health_alerts')
      .select('id')
      .eq('signature', signature)
      .gt('alerted_at', dedupeSince)
      .limit(1);
    if (recent && recent.length > 0) {
      return new Response(JSON.stringify({ ok: true, attempts: attempts.length, fulfilled, alerted: false, reason: 'deduped' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lost = attempts
      .filter((r: any) => r.status !== 'fulfilled')
      .reduce((sum: number, r: any) => sum + Number(r.total_charge || 0), 0);

    const message = fatalIssues.size > 0
      ? `PayPal is rejecting payments at the account level.\n\n`
        + `Error(s): ${[...fatalIssues].join(', ')}\n`
        + `Last ${WINDOW_HOURS}h: ${attempts.length} attempts, ${fulfilled} completed.\n`
        + `This is a merchant-account capability problem — it cannot be fixed in code. Contact PayPal support.`
      : `${attempts.length} payment attempts in the last ${WINDOW_HOURS}h and NOT ONE completed.\n\n`
        + `Approx. value at risk: ${lost.toFixed(2)}\n`
        + `Check the PayPal Order Attempts admin page for the error details.`;

    await fetch(`${SUPABASE_URL}/functions/v1/telegram-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        type: 'fraud', // 🚨 — this is revenue-critical
        title: 'PayPal payments are failing',
        message,
      }),
    }).catch((e) => console.error('telegram-notify failed', e));

    await supabase.from('payment_health_alerts').insert({
      signature,
      attempts: attempts.length,
      fulfilled,
      details: message,
    });

    return new Response(JSON.stringify({ ok: true, attempts: attempts.length, fulfilled, alerted: true, signature }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('paypal-failure-watch error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
