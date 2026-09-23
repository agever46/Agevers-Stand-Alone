import { requireAdminOrService } from "../_shared/adminAuth.ts";
// Daily cron: checks Kinguin EUR balance and pings Telegram if it drops below threshold.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOW_BALANCE_THRESHOLD = 100; // EUR

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authFail = await requireAdminOrService(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const KINGUIN_API_KEY = Deno.env.get('KINGUIN_API_KEY');
    if (!KINGUIN_API_KEY) throw new Error('KINGUIN_API_KEY not configured');

    const res = await fetch('https://gateway.kinguin.net/esa/api/v1/balance', {
      headers: { 'X-Api-Key': KINGUIN_API_KEY },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Kinguin balance API error [${res.status}]: ${errText}`);
    }
    const data = await res.json();
    const balance = Number(data.balance ?? 0);

    if (balance < LOW_BALANCE_THRESHOLD) {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
      await fetch(`${SUPABASE_URL}/functions/v1/telegram-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'stock',
          title: 'Low Kinguin Balance',
          message: `Current balance: €${balance.toFixed(2)} (threshold: €${LOW_BALANCE_THRESHOLD})`,
          meta: { balance, threshold: LOW_BALANCE_THRESHOLD },
        }),
      });
    }

    return new Response(JSON.stringify({ balance, alerted: balance < LOW_BALANCE_THRESHOLD }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('kinguin-balance-check error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});