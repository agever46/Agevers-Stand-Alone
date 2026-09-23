// Reveal-time Kinguin fulfillment.
// Called by the Order Confirmation page when the user clicks
// "I Agree — View My Code" — only at this moment do we actually purchase
// the key from Kinguin (if it wasn't already covered by manual / seller keys).
// This avoids spending money on Kinguin if the buyer never reveals.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KINGUIN_API = "https://gateway.kinguin.net/esa/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anon.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { paypal_order_id } = await req.json();
    if (!paypal_order_id) throw new Error("Missing paypal_order_id");

    // Server-side OTP gate: require a used purchase OTP within the last 24h.
    // Skip this check only if the codes for this paypal order were already
    // revealed (codes_viewed = true) — the OTP was validated at first reveal.
    const { data: alreadyViewed } = await admin
      .from("orders")
      .select("id")
      .eq("paypal_order_id", paypal_order_id)
      .eq("user_id", user.id)
      .eq("codes_viewed", true)
      .limit(1);

    if (!alreadyViewed || alreadyViewed.length === 0) {
      const { data: otpOk } = await admin
        .from("purchase_otp_codes")
        .select("id")
        .eq("user_id", user.id)
        .eq("used", true)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);
      if (!otpOk || otpOk.length === 0) {
        return new Response(
          JSON.stringify({ error: "otp_required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fetch all orders for this paypal order belonging to the user
    const { data: orders, error: ordersErr } = await admin
      .from("orders")
      .select("id, game_title, quantity, status, game_code, pending_kinguin, is_held")
      .eq("paypal_order_id", paypal_order_id)
      .eq("user_id", user.id);

    if (ordersErr) throw new Error(ordersErr.message);
    if (!orders || orders.length === 0) throw new Error("Order not found");

    const results: Array<{ order_id: string; status: string; reason?: string }> = [];

    for (const order of orders) {
      // Skip orders that don't need a Kinguin purchase
      if (order.is_held) {
        results.push({ order_id: order.id, status: "held" });
        continue;
      }
      // A refund means the buyer must not receive the code — never spend
      // money buying the key from Kinguin for an order that's been refunded.
      if (order.status === "refunded" || order.status === "partially_refunded") {
        results.push({ order_id: order.id, status: order.status });
        continue;
      }
      const pending = order.pending_kinguin as
        | { kinguin_product_id: string; qty: number; expected_price: number | null }
        | null;

      if (!pending) {
        results.push({ order_id: order.id, status: "ready" });
        continue;
      }

      if (!KINGUIN_API_KEY) {
        results.push({ order_id: order.id, status: "error", reason: "Kinguin not configured" });
        continue;
      }

      // Concurrency lock: atomically claim the pending purchase. If another
      // concurrent invocation (double click / second tab) already claimed it,
      // pending_kinguin is no longer set and we must NOT buy the key twice.
      const { data: claimed } = await admin
        .from("orders")
        .update({ pending_kinguin: null })
        .eq("id", order.id)
        .not("pending_kinguin", "is", null)
        .select("id");

      if (!claimed || claimed.length === 0) {
        results.push({ order_id: order.id, status: "processing", reason: "already_in_progress" });
        continue;
      }

      try {
        // Fetch current Kinguin price/stock
        const priceRes = await fetch(
          `${KINGUIN_API}/v2/products/${pending.kinguin_product_id}`,
          { headers: { "X-Api-Key": KINGUIN_API_KEY } },
        );
        if (!priceRes.ok) {
          await priceRes.text();
          throw new Error(`Kinguin price fetch failed [${priceRes.status}]`);
        }
        const kpData = await priceRes.json();
        const kinguinPrice: number = kpData.price;
        const currentStock: number = kpData.qty ?? kpData.totalQty ?? 0;
        const buyQty = Math.min(pending.qty, currentStock);

        if (!kinguinPrice || buyQty <= 0) {
          // No stock — mark order as held for admin
          await admin
            .from("orders")
            .update({
              status: "held",
              is_held: true,
              held_reason: `Out of stock at Kinguin at reveal time (need ${pending.qty}, have ${currentStock})`,
              held_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              // Restore the claim instead of clearing it — a later reveal
              // (customer retry, or admin "Approve" routing back to
              // awaiting_reveal) must still know what to buy. Nulling it here
              // left the order permanently stuck: reveal-and-fulfill treats a
              // null pending_kinguin as "nothing to do" and never buys the key.
              pending_kinguin: pending,
            })
            .eq("id", order.id);
          results.push({ order_id: order.id, status: "held", reason: "out_of_stock" });
          continue;
        }

        // Place the Kinguin order.
        // Kinguin rejects with 422 InvalidPrice when the offer price moved
        // between our price read and the order. Re-quote and retry a few
        // times (with a sane ceiling) instead of failing the buyer.
        const priceCeiling = kinguinPrice * 1.25 + 0.5;
        let attemptPrice = kinguinPrice;
        let orderData: any = null;
        let lastErr = "";

        for (let attempt = 0; attempt < 3; attempt++) {
          const orderRes = await fetch(`${KINGUIN_API}/v2/order`, {
            method: "POST",
            headers: {
              "X-Api-Key": KINGUIN_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              products: [
                {
                  productId: pending.kinguin_product_id,
                  qty: buyQty,
                  price: attemptPrice,
                  keyType: "text",
                },
              ],
            }),
          });

          if (orderRes.ok) {
            orderData = await orderRes.json();
            break;
          }

          const errText = await orderRes.text();
          lastErr = `Kinguin order failed [${orderRes.status}]: ${errText}`;

          let isInvalidPrice = false;
          let suggested: number | null = null;
          try {
            const errJson = JSON.parse(errText);
            isInvalidPrice = errJson?.reason === "InvalidPrice";
            if (typeof errJson?.price === "number") suggested = errJson.price;
          } catch { /* non-JSON error body */ }

          if (orderRes.status !== 422 || !isInvalidPrice) throw new Error(lastErr);

          // Re-quote: prefer the price Kinguin reports, else re-read the product.
          let nextPrice = suggested;
          if (nextPrice === null) {
            const reRes = await fetch(
              `${KINGUIN_API}/v2/products/${pending.kinguin_product_id}`,
              { headers: { "X-Api-Key": KINGUIN_API_KEY } },
            );
            if (reRes.ok) {
              const re = await reRes.json();
              if (typeof re?.price === "number") nextPrice = re.price;
            } else {
              await reRes.text();
            }
          }

          if (!nextPrice || nextPrice <= 0) throw new Error(lastErr);
          if (nextPrice > priceCeiling) {
            throw new Error(
              `Kinguin price rose above safety ceiling (quoted ${nextPrice}, ceiling ${priceCeiling.toFixed(2)})`,
            );
          }
          attemptPrice = nextPrice;
          await new Promise((r) => setTimeout(r, 1000));
        }

        if (!orderData) throw new Error(lastErr || "Kinguin order failed");
        const kinguinOrderId = orderData.orderId;

        // Poll for keys (15 × 2s = 30s max)
        let fetchedKeys: string[] = [];
        for (let j = 0; j < 15; j++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const keysRes = await fetch(
            `${KINGUIN_API}/v2/order/${kinguinOrderId}/keys`,
            { headers: { "X-Api-Key": KINGUIN_API_KEY } },
          );
          if (keysRes.ok) {
            const keys = await keysRes.json();
            const serials = (keys as any[])
              .filter((k) => k.serial)
              .map((k) => k.serial as string);
            if (serials.length >= buyQty) {
              fetchedKeys = serials;
              break;
            }
            if (serials.length > 0) fetchedKeys = serials;
          } else {
            await keysRes.text();
          }
        }

        // Merge with any existing manual/seller code already on the order
        const existing = (order.game_code || "")
          .split("\n")
          .map((s: string) => s.trim())
          .filter(Boolean);
        const merged = [...existing, ...fetchedKeys];

        await admin.from("kinguin_orders").insert({
          order_id: order.id,
          kinguin_order_id: kinguinOrderId,
          kinguin_product_id: pending.kinguin_product_id,
          kinguin_price: attemptPrice * buyQty,
          status: fetchedKeys.length >= buyQty ? "completed" : "processing",
          game_key: fetchedKeys.length > 0 ? fetchedKeys.join("\n") : null,
        });

        // Update Kinguin local stock
        const stockAfterPurchase = Math.max(currentStock - buyQty, 0);
        await admin
          .from("kinguin_products")
          .update({
            kinguin_stock: stockAfterPurchase,
            last_stock_check: new Date().toISOString(),
            is_active: stockAfterPurchase > 0,
            last_change_summary: `stock ${currentStock}→${stockAfterPurchase} (purchase: bought ${buyQty})`,
            last_change_at: new Date().toISOString(),
            last_change_source: "purchase",
          })
          .eq("kinguin_product_id", pending.kinguin_product_id);

        await admin
          .from("orders")
          .update({
            game_code: merged.length > 0 ? merged.join("\n") : null,
            status: merged.length >= order.quantity ? "completed" : "processing",
            pending_kinguin: null,
          })
          .eq("id", order.id);

        results.push({
          order_id: order.id,
          status: merged.length >= order.quantity ? "completed" : "processing",
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "unknown";
        console.error(`reveal-and-fulfill failed for order ${order.id}:`, message);
        // Mark as held so admin can intervene. Restore pending_kinguin (the
        // concurrency-lock claim above nulled it) so a later retry still
        // knows what to buy — otherwise this order can never be fulfilled
        // automatically again, since reveal-and-fulfill treats a null
        // pending_kinguin as "nothing to do" rather than "buy failed".
        await admin
          .from("orders")
          .update({
            status: "held",
            is_held: true,
            held_reason: `Reveal-time fulfillment error: ${message}`,
            held_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            pending_kinguin: pending,
          })
          .eq("id", order.id);
        results.push({ order_id: order.id, status: "error", reason: message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("reveal-and-fulfill error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});