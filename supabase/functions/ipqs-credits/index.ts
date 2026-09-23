import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const IPQS_API_KEY = Deno.env.get('IPQS_API_KEY');
    if (!IPQS_API_KEY) throw new Error('IPQS_API_KEY not configured');

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

    // IPQS account endpoint — returns credits/usage info
    const res = await fetch(`https://ipqualityscore.com/api/json/account/${IPQS_API_KEY}`);
    if (!res.ok) {
      throw new Error(`IPQS account API error [${res.status}]`);
    }
    const data = await res.json();

    // Common fields returned by IPQS account endpoint
    const credits = Number(data.credits ?? 0);
    const usage = Number(data.usage ?? 0);
    const proxyCreditsRemaining = Number(data.proxy_credits_remaining ?? credits);
    const emailCreditsRemaining = Number(data.email_credits_remaining ?? 0);

    return new Response(JSON.stringify({
      success: data.success !== false,
      credits,
      usage,
      proxy_credits_remaining: proxyCreditsRemaining,
      email_credits_remaining: emailCreditsRemaining,
      raw: data,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('ipqs-credits error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});