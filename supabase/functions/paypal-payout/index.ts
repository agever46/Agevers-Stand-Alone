import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const paypalSecret = Deno.env.get("PAYPAL_SECRET");

    if (!paypalClientId || !paypalSecret) {
      throw new Error("PayPal credentials not configured");
    }

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) throw new Error("Unauthorized");

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (roleData || []).map((r: any) => r.role);
      if (!roles.includes("admin") && !roles.includes("super_admin")) {
        throw new Error("Admin access required");
      }
    } else {
      throw new Error("No authorization header");
    }

    const { withdrawal_id } = await req.json();
    if (!withdrawal_id) throw new Error("withdrawal_id required");

    // Get withdrawal details
    const { data: withdrawal, error: wError } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawal_id)
      .single();

    if (wError || !withdrawal) throw new Error("Withdrawal not found");
    if (withdrawal.method !== "paypal") throw new Error("Only PayPal withdrawals can be auto-paid");
    if (!withdrawal.paypal_email) throw new Error("No PayPal email on withdrawal");
    if (withdrawal.status !== "approved") throw new Error("Withdrawal must be approved first");

    // Get PayPal access token
    const PAYPAL_BASE = paypalClientId.startsWith("sb-") 
      ? "https://api-m.sandbox.paypal.com" 
      : "https://api-m.paypal.com";

    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${paypalClientId}:${paypalSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      throw new Error(`PayPal auth failed [${tokenRes.status}]: ${errBody}`);
    }

    const { access_token } = await tokenRes.json();

    // Create payout
    const payoutRes = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: `withdrawal_${withdrawal_id}_${Date.now()}`,
          email_subject: "You have a payment from Agever",
          email_message: "Your withdrawal request has been processed.",
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: {
              value: Number(withdrawal.amount).toFixed(2),
              currency: "EUR",
            },
            receiver: withdrawal.paypal_email,
            note: `Withdrawal #${withdrawal_id.slice(0, 8)}`,
            sender_item_id: withdrawal_id,
          },
        ],
      }),
    });

    const payoutData = await payoutRes.json();

    if (!payoutRes.ok) {
      // Update withdrawal with error
      await supabase
        .from("withdrawal_requests")
        .update({
          admin_note: `PayPal payout failed: ${JSON.stringify(payoutData)}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", withdrawal_id);

      throw new Error(`PayPal payout failed [${payoutRes.status}]: ${JSON.stringify(payoutData)}`);
    }

    // Update withdrawal as completed
    await supabase
      .from("withdrawal_requests")
      .update({
        status: "completed",
        admin_note: `Auto-paid via PayPal. Batch ID: ${payoutData.batch_header?.payout_batch_id || "N/A"}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", withdrawal_id);

    return new Response(
      JSON.stringify({ success: true, batch_id: payoutData.batch_header?.payout_batch_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("PayPal payout error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});