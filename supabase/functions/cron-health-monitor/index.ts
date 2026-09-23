// Periodic canary check for the cron-invoked functions that were found
// silently 401ing on 2026-08-19/20 (wrong/missing service-role auth header).
// Pings each one with ?healthCheckOnly=1 (auth-only, no real side effects),
// records the outcome in cron_health_status, and alerts Telegram once a
// function has failed twice in a row (to skip one-off network blips) —
// then alerts again on recovery so the "still broken" state doesn't linger
// silently. Scheduled every 30 minutes from a plain SQL cron job.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceOrInternal } from "../_shared/adminAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TARGETS = [
  'kinguin-stock-sync',
  'kinguin-preorder-sync',
  'process-verification-reminders',
  'process-wishlist-alerts',
  'auto-create-bundle',
  'paypal-health-check',
];

const FAILURE_THRESHOLD_TO_ALERT = 2;
const REMINDER_EVERY_N_FAILURES = 6; // ~3h at a 30-min check interval

async function probe(supabaseUrl: string, serviceKey: string, name: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${name}?healthCheckOnly=1`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    });
    if (res.ok) return { ok: true as const };
    const text = await res.text().catch(() => '');
    return { ok: false as const, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timeout);
  }
}

async function notifyTelegram(supabaseUrl: string, internalToken: string, title: string, message: string, meta: Record<string, unknown>) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/telegram-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': internalToken },
      body: JSON.stringify({ type: 'cron', title, message, meta }),
    });
  } catch (e) {
    console.error('telegram-notify call failed:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authFail = await requireServiceOrInternal(req, corsHeaders);
  if (authFail) return authFail;

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const INTERNAL_TOKEN = Deno.env.get('INTERNAL_NOTIFY_TOKEN_V3') || '';
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const results: Record<string, { ok: boolean; error?: string }> = {};

  for (const name of TARGETS) {
    const outcome = await probe(SUPABASE_URL, SERVICE_KEY, name);
    results[name] = outcome;

    const { data: existing } = await supabase
      .from('cron_health_status')
      .select('consecutive_failures, alert_sent_at')
      .eq('function_name', name)
      .maybeSingle();

    const now = new Date().toISOString();

    if (outcome.ok) {
      const wasAlerting = !!existing?.alert_sent_at;
      await supabase.from('cron_health_status').upsert({
        function_name: name,
        status: 'ok',
        last_checked_at: now,
        last_ok_at: now,
        consecutive_failures: 0,
        alert_sent_at: null,
        updated_at: now,
      });
      if (wasAlerting) {
        await notifyTelegram(SUPABASE_URL, INTERNAL_TOKEN, `✅ ${name} recovered`, `The cron-invoked function "${name}" is responding correctly again.`, { function: name });
      }
    } else {
      const consecutiveFailures = (existing?.consecutive_failures || 0) + 1;
      const shouldAlert =
        consecutiveFailures === FAILURE_THRESHOLD_TO_ALERT ||
        (consecutiveFailures > FAILURE_THRESHOLD_TO_ALERT &&
          (consecutiveFailures - FAILURE_THRESHOLD_TO_ALERT) % REMINDER_EVERY_N_FAILURES === 0);

      await supabase.from('cron_health_status').upsert({
        function_name: name,
        status: 'failing',
        last_checked_at: now,
        last_failure_at: now,
        last_error: outcome.error,
        consecutive_failures: consecutiveFailures,
        alert_sent_at: shouldAlert ? now : (existing?.alert_sent_at ?? null),
        updated_at: now,
      });

      if (shouldAlert) {
        await notifyTelegram(
          SUPABASE_URL,
          INTERNAL_TOKEN,
          `🚨 ${name} is failing its cron auth check`,
          `${consecutiveFailures} consecutive failed checks (every 30 min). This is the same failure mode found on 2026-08-19/20 (wrong service-role auth).`,
          { function: name, error: outcome.error, consecutive_failures: consecutiveFailures },
        );
      }
    }
  }

  return new Response(JSON.stringify({ checked: TARGETS.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
