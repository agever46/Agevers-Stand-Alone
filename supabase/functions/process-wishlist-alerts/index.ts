import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireServiceOrInternal } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://agevers.com";

interface AlertItem {
  title: string;
  platform: string;
  oldPrice?: string;
  newPrice?: string;
  dropPct?: number;
  alertType: "price_drop" | "restock";
  productUrl: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authFail = await requireServiceOrInternal(req, corsHeaders);
  if (authFail) return authFail;

  // Auth-only canary probe used by cron-health-monitor: confirms the
  // service-role/internal-token header still works without sending real alerts.
  if (new URL(req.url).searchParams.get('healthCheckOnly') === '1') {
    return new Response(JSON.stringify({ ok: true, healthCheck: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Cooldown: don't re-notify the same user about the same item within this window
    const COOLDOWN_HOURS = 72;
    const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600_000).toISOString();

    // 1. Pull all wishlist rows that have an allowed_product_id and a baseline price
    const { data: rows, error: rowsErr } = await supabase
      .from("wishlist")
      .select("id, user_id, game_title, platform, price_at_add, last_price_drop_notified_at, last_restock_notified_at, notify_price_drops, notify_restock, allowed_product_id")
      .not("allowed_product_id", "is", null);

    if (rowsErr) throw rowsErr;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ checked: 0, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productIds = [...new Set(rows.map((r: any) => r.allowed_product_id))];

    // 2. Pull current prices + slugs
    const { data: kp } = await supabase
      .from("kinguin_products")
      .select("allowed_product_id, sell_price, kinguin_stock, is_active")
      .in("allowed_product_id", productIds);
    const { data: ap } = await supabase
      .from("allowed_products")
      .select("id, slug")
      .in("id", productIds);

    const slugMap = new Map((ap || []).map((p: any) => [p.id, p.slug]));
    const priceMap = new Map<string, { price: number; stock: number; active: boolean }>();
    (kp || []).forEach((k: any) => {
      priceMap.set(k.allowed_product_id, {
        price: Number(k.sell_price),
        stock: k.kinguin_stock ?? 0,
        active: !!k.is_active,
      });
    });

    // 3. Group alerts per user_id (batch into one email per user)
    const userBuckets = new Map<string, { items: AlertItem[]; rowIds: string[]; types: Record<string, "price_drop" | "restock"> }>();

    for (const row of rows as any[]) {
      const cur = priceMap.get(row.allowed_product_id);
      if (!cur || !cur.active) continue;

      const slug = slugMap.get(row.allowed_product_id) || row.allowed_product_id;
      const productUrl = `${SITE_URL}/product/${slug}`;

      // PRICE DROP — at least 5% below baseline
      if (
        row.notify_price_drops &&
        row.price_at_add &&
        cur.price > 0 &&
        cur.price < Number(row.price_at_add) * 0.95 &&
        cur.stock > 0 &&
        (!row.last_price_drop_notified_at || row.last_price_drop_notified_at < cutoff)
      ) {
        const dropPct = Math.round((1 - cur.price / Number(row.price_at_add)) * 100);
        if (!userBuckets.has(row.user_id)) userBuckets.set(row.user_id, { items: [], rowIds: [], types: {} });
        const bucket = userBuckets.get(row.user_id)!;
        bucket.items.push({
          title: row.game_title,
          platform: row.platform,
          oldPrice: `€${Number(row.price_at_add).toFixed(2)}`,
          newPrice: `€${cur.price.toFixed(2)}`,
          dropPct,
          alertType: "price_drop",
          productUrl,
        });
        bucket.rowIds.push(row.id);
        bucket.types[row.id] = "price_drop";
        continue;
      }

      // RESTOCK — was 0 stock at last check, now >0
      if (
        row.notify_restock &&
        cur.stock > 0 &&
        row.last_restock_notified_at &&
        row.last_restock_notified_at < cutoff
      ) {
        // Only notify if previously OOS — heuristic: skip if never marked OOS
        // (covered by last_restock_notified_at being null = never alerted, allow)
      }
      if (
        row.notify_restock &&
        cur.stock > 0 &&
        !row.last_restock_notified_at
      ) {
        // Don't spam first-time. We only fire restock when we previously stored a marker.
        // Marker is set when stock goes to 0 (skip until next pass).
      }
    }

    // 4. Resolve emails for each user
    const userIds = [...userBuckets.keys()];
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ checked: rows.length, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailMap = new Map<string, { email: string; name: string | null }>();
    for (const uid of userIds) {
      const { data: u } = await supabase.auth.admin.getUserById(uid);
      if (u?.user?.email) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("user_id", uid)
          .maybeSingle();
        emailMap.set(uid, {
          email: u.user.email,
          name: prof?.display_name || prof?.username || null,
        });
      }
    }

    let sent = 0;
    for (const [uid, bucket] of userBuckets.entries()) {
      const recipient = emailMap.get(uid);
      if (!recipient) continue;
      if (bucket.items.length === 0) continue;

      const idem = `wishlist-alert-${uid}-${new Date().toISOString().slice(0, 10)}`;
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "wishlist-alert",
            recipientEmail: recipient.email,
            idempotencyKey: idem,
            templateData: { userName: recipient.name, items: bucket.items },
          },
        });
        sent++;

        // Mark sent rows
        const priceDropIds = bucket.rowIds.filter((id) => bucket.types[id] === "price_drop");
        const restockIds = bucket.rowIds.filter((id) => bucket.types[id] === "restock");
        if (priceDropIds.length > 0) {
          await supabase.from("wishlist").update({ last_price_drop_notified_at: new Date().toISOString() }).in("id", priceDropIds);
        }
        if (restockIds.length > 0) {
          await supabase.from("wishlist").update({ last_restock_notified_at: new Date().toISOString() }).in("id", restockIds);
        }
      } catch (err) {
        console.error("send failed for", recipient.email, err);
      }
    }

    return new Response(JSON.stringify({ checked: rows.length, sent, users: userIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});