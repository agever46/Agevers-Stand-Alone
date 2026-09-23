import { createClient } from "jsr:@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Restrict to service-role callers (pg_cron). Prevents public triggering of
  // abandoned-cart email dispatches.
  const authToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (authToken !== SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_ROLE);

  try {
    // Find carts updated 4-24 hours ago, not yet emailed, with items
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: carts, error } = await supabase
      .from("abandoned_carts")
      .select("id, user_id, cart_items, updated_at")
      .eq("email_sent", false)
      .lte("updated_at", fourHoursAgo)
      .gte("updated_at", oneDayAgo);

    if (error) throw error;
    if (!carts || carts.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0;
    for (const cart of carts) {
      const items = (cart.cart_items as any[]) || [];
      if (items.length === 0) continue;

      // Get user email + name
      const { data: userData } = await supabase.auth.admin.getUserById(cart.user_id);
      if (!userData?.user?.email) continue;
      const { data: profile } = await supabase
        .from("profiles").select("display_name, username").eq("user_id", cart.user_id).maybeSingle();

      const total = items.reduce((s: number, i: any) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
      const templateData = {
        userName: profile?.display_name || profile?.username || undefined,
        items: items.slice(0, 5).map((i: any) => ({
          title: i.title,
          platform: i.platform,
          price: `€${(Number(i.price) || 0).toFixed(2)}`,
          image_url: i.image_url || undefined,
        })),
        total: `€${total.toFixed(2)}`,
      };

      const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "cart-abandonment",
          recipientEmail: userData.user.email,
          idempotencyKey: `cart-abandon-${cart.id}-${cart.updated_at}`,
          templateData,
        },
      });

      if (!sendErr) {
        await supabase.from("abandoned_carts").update({ email_sent: true }).eq("id", cart.id);
        sent++;
      }
    }

    return new Response(JSON.stringify({ processed: carts.length, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-abandoned-carts error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
