import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const PROXYCHECK_API_KEY = Deno.env.get('PROXYCHECK_API_KEY');
    if (!PROXYCHECK_API_KEY) throw new Error('PROXYCHECK_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Not authenticated');

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) throw new Error('Not authorized');

    const res = await fetch(`https://proxycheck.io/dashboard/export/usage/?key=${PROXYCHECK_API_KEY}`);
    if (!res.ok) {
      const body = await res.text();
      console.error(`ProxyCheck usage API error [${res.status}]: ${body}`);
      return new Response(JSON.stringify({ error: 'ProxyCheck usage request failed', status: res.status, details: body }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const data = await res.json();

    // ProxyCheck returns: { "Queries Today": n, "Daily Limit": n, "Plan Tier": "..." }
    const used = Number(data['Queries Today'] ?? 0);
    const limit = Number(data['Daily Limit'] ?? 0);
    const credits = Math.max(limit - used, 0);

    return new Response(JSON.stringify({
      success: true,
      credits,
      usage: used,
      daily_limit: limit,
      plan: data['Plan Tier'] ?? null,
      raw: data,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('proxycheck-credits error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
