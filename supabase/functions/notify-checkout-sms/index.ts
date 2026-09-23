// Sends an SMS to admin when a user reaches the Checkout page with items in cart.
// Rate-limited per user (in-memory) to avoid spam from page refreshes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory dedupe: userId -> last sent timestamp (10 min cooldown)
const recentNotifications = new Map<string, number>();
const COOLDOWN_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, t] of recentNotifications) {
    if (now - t > COOLDOWN_MS) recentNotifications.delete(k);
  }
}, 5 * 60 * 1000);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require a valid signed-in user — anonymous callers cannot trigger SMS to admin.
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const verifiedUserId = authData.user.id;
    const verifiedEmail = authData.user.email || '';

    const ADMIN_PHONE = Deno.env.get('ADMIN_NOTIFY_PHONE') || '';
    if (!ADMIN_PHONE) {
      return new Response(JSON.stringify({ error: 'Admin phone not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { itemCount, totalValue, currency } = await req.json().catch(() => ({}));

    // Dedupe by the verified user id so an attacker cannot rotate client-supplied keys.
    const dedupeKey = verifiedUserId;
    const now = Date.now();
    const last = recentNotifications.get(dedupeKey);
    if (last && now - last < COOLDOWN_MS) {
      return new Response(JSON.stringify({ skipped: true, reason: 'cooldown' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    recentNotifications.set(dedupeKey, now);

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
    const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

    if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
      return new Response(JSON.stringify({ error: 'SMS not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const items = Number(itemCount) || 0;
    const total = Number(totalValue) || 0;
    const cur = String(currency || 'EUR').toUpperCase().slice(0, 4);
    const who = verifiedEmail ? String(verifiedEmail).slice(0, 60) : 'Signed-in user';

    const body = `Agever's: Checkout visit by ${who} - ${items} item(s), ${cur} ${total.toFixed(2)}.`;

    const basicAuth = btoa(`${accountSid}:${authToken}`);
    const params = new URLSearchParams({ To: ADMIN_PHONE, Body: body });
    if (messagingServiceSid) params.set('MessagingServiceSid', messagingServiceSid);
    else params.set('From', fromNumber!);
    const smsRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      }
    );

    const text = await smsRes.text();
    if (!smsRes.ok) {
      console.error('Twilio error:', smsRes.status, text);
      return new Response(JSON.stringify({ error: 'twilio_failed', status: smsRes.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('notify-checkout-sms error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});