import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PACK = { plays: 5, usd: 1.0 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) throw new Error("Not authenticated");

    const { orderId } = await req.json();
    if (!orderId || typeof orderId !== "string") throw new Error("Missing orderId");

    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const secret = Deno.env.get("PAYPAL_SECRET");
    if (!clientId || !secret) throw new Error("PayPal not configured");
    const isLive = Deno.env.get("PAYPAL_LIVE")?.toLowerCase() === "true";
    const baseUrl = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

    const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const authData = await authRes.json();
    if (!authData.access_token) throw new Error("PayPal auth failed");

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${authData.access_token}` },
    });
    const orderData = await orderRes.json();
    if (orderData.status !== "COMPLETED") throw new Error(`Order not completed (${orderData.status})`);

    // The PayPal order must belong to the signed-in account. Without this a
    // user could submit somebody else's completed order id and claim the plays.
    const orderOwner = orderData.purchase_units?.[0]?.custom_id;
    if (orderOwner && orderOwner !== user.id) {
      throw new Error("This payment belongs to a different account");
    }

    const unit = orderData.purchase_units?.[0]?.amount;
    const paidAmount = parseFloat(unit?.value ?? "0");
    const paidCurrency = unit?.currency_code;
    if (paidCurrency !== "USD" || paidAmount + 0.001 < PACK.usd) {
      throw new Error(`Invalid amount/currency: ${paidAmount} ${paidCurrency}`);
    }

    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    // Idempotency: if this orderId was already used, return current state
    const { data: existing } = await svc
      .from("play_purchases")
      .select("id")
      .eq("paypal_order_id", orderId)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, alreadyProcessed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insErr } = await svc.from("play_purchases").insert({
      user_id: user.id,
      plays_bought: PACK.plays,
      plays_remaining: PACK.plays,
      amount_paid: paidAmount,
      paypal_order_id: orderId,
    });
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ success: true, playsAdded: PACK.plays }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("buy-plays-paypal error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});