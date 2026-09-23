// Admin/internal: retry a Kinguin key purchase for an existing order.
// Safe re-run: first polls the previously placed Kinguin order for keys,
// and only buys again if that order never produced any key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const KINGUIN_API = "https://gateway.kinguin.net/esa/api";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const opsToken = Deno.env.get("ADMIN_RETRY_TOKEN");
  const hasOpsToken = !!opsToken && req.headers.get("x-admin-retry-token") === opsToken;
  if (!hasOpsToken) {
    const guard = await requireAdminOrService(req, corsHeaders);
    if (guard) return guard;
  }


  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");
    if (!KINGUIN_API_KEY) throw new Error("KINGUIN_API_KEY not configured");
    const kh = { "X-Api-Key": KINGUIN_API_KEY };

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { order_id } = await req.json();
    if (!order_id) throw new Error("Missing order_id");

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, game_title, quantity, status, game_code, pending_kinguin")
      .eq("id", order_id)
      .single();
    if (oErr || !order) throw new Error("Order not found");

    const qty = order.quantity || 1;
    const existingCodes = (order.game_code || "")
      .split("\n").map((s: string) => s.trim()).filter(Boolean);

    const { data: ko } = await admin
      .from("kinguin_orders")
      .select("*")
      .eq("order_id", order_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pending = order.pending_kinguin as
      | { kinguin_product_id: string; qty: number } | null;
    const productId = ko?.kinguin_product_id || pending?.kinguin_product_id;
    if (!productId) throw new Error("No Kinguin product mapping for this order");

    const collect = async (kinguinOrderId: string, attempts: number) => {
      let serials: string[] = [];
      for (let i = 0; i < attempts; i++) {
        const r = await fetch(`${KINGUIN_API}/v2/order/${kinguinOrderId}/keys`, { headers: kh });
        if (r.ok) {
          const keys = await r.json();
          const s = (keys as any[]).filter((k) => k.serial).map((k) => k.serial as string);
          if (s.length > serials.length) serials = s;
          if (serials.length >= qty) break;
        } else {
          await r.text();
        }
        if (i < attempts - 1) await new Promise((res) => setTimeout(res, 2000));
      }
      return serials;
    };

    let serials: string[] = [];
    let usedOrderId = ko?.kinguin_order_id || null;
    let repurchased = false;

    // 1) Try the previously placed order first (avoid double-buying)
    if (usedOrderId) serials = await collect(usedOrderId, 3);

    // 2) Nothing came back — buy again
    if (serials.length < qty) {
      const priceRes = await fetch(`${KINGUIN_API}/v2/products/${productId}`, { headers: kh });
      if (!priceRes.ok) throw new Error(`Kinguin price fetch failed [${priceRes.status}]`);
      const kp = await priceRes.json();
      const price: number = kp.price;
      const stock: number = kp.qty ?? kp.totalQty ?? 0;
      const need = qty - serials.length;
      if (!price) throw new Error("Could not determine Kinguin price");
      if (stock < need) return json({ error: `Out of stock (need ${need}, have ${stock})` }, 409);

      const balRes = await fetch(`${KINGUIN_API}/v1/balance`, { headers: kh });
      const bal = balRes.ok ? await balRes.json() : null;
      const balance = Number(bal?.balance ?? bal?.total ?? NaN);
      if (!Number.isNaN(balance) && balance < price * need) {
        return json({ error: `Insufficient Kinguin balance (need ${(price * need).toFixed(2)}, have ${balance})` }, 402);
      }

      const orderRes = await fetch(`${KINGUIN_API}/v2/order`, {
        method: "POST",
        headers: { ...kh, "Content-Type": "application/json" },
        body: JSON.stringify({
          products: [{ productId, qty: need, price, keyType: "text" }],
        }),
      });
      if (!orderRes.ok) {
        const t = await orderRes.text();
        throw new Error(`Kinguin order failed [${orderRes.status}]: ${t}`);
      }
      const od = await orderRes.json();
      usedOrderId = od.orderId;
      repurchased = true;

      const fresh = await collect(usedOrderId!, 15);
      serials = [...serials, ...fresh].filter((v, i, a) => a.indexOf(v) === i);

      await admin.from("kinguin_orders").insert({
        order_id,
        kinguin_order_id: usedOrderId,
        kinguin_product_id: productId,
        kinguin_price: price * need,
        status: serials.length >= qty ? "completed" : "processing",
        game_key: serials.length ? serials.join("\n") : null,
      });
    } else if (ko) {
      await admin.from("kinguin_orders")
        .update({ game_key: serials.join("\n"), status: "completed" })
        .eq("id", ko.id);
    }

    if (serials.length === 0) {
      return json({ success: false, kinguin_order_id: usedOrderId, repurchased, message: "No keys returned yet" }, 202);
    }

    const merged = [...existingCodes, ...serials].filter((v, i, a) => a.indexOf(v) === i);
    await admin.from("orders").update({
      game_code: merged.join("\n"),
      status: merged.length >= qty ? "completed" : "processing",
      pending_kinguin: null,
      is_held: false,
      held_reason: null,
    }).eq("id", order_id);

    return json({
      success: true,
      repurchased,
      kinguin_order_id: usedOrderId,
      keys_delivered: serials.length,
      order_status: merged.length >= qty ? "completed" : "processing",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("admin-kinguin-retry:", message);
    return json({ error: message }, 400);
  }
});
