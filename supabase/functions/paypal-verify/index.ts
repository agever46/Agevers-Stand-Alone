import { requireAdminOrService } from "../_shared/adminAuth.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = await requireAdminOrService(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Missing orderId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const secret = Deno.env.get('PAYPAL_SECRET');

    if (!clientId || !secret) {
      return new Response(JSON.stringify({ error: 'PayPal not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isLive = Deno.env.get('PAYPAL_LIVE')?.toLowerCase() === 'true';
    const baseUrl = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    // Get access token
    const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${clientId}:${secret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const authData = await authRes.json();
    if (!authData.access_token) {
      return new Response(JSON.stringify({ error: 'Failed to authenticate with PayPal' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify order
    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const orderData = await orderRes.json();
    const verified = orderData.status === 'COMPLETED';

    return new Response(JSON.stringify({
      verified,
      status: orderData.status,
      amount: orderData.purchase_units?.[0]?.amount?.value,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
