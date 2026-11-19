// Re-verifies cart items against Kinguin's LIVE price/stock right before the
// customer reaches the payment step. Our own kinguin_products cache is only
// refreshed by a 5-hour cron (kinguin-stock-sync), so a customer could
// otherwise see/pay a price that's already stale, or add an item that Kinguin
// has gone out of stock on since our last sync. This closes that gap at the
// one place it matters for UX — checkout — on top of the existing hard
// server-side guard in reveal-and-fulfill (which always buys at Kinguin's
// live price regardless of what happened here).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KINGUIN_API = "https://gateway.kinguin.net/esa/api";
const KINGUIN_MARKUP = 0.0735;
const PRICE_TOLERANCE_EUR = 0.01;

interface CartItemIn {
  offerId: string;
  quantity: number;
  price: number; // what the client currently shows/would charge
}

interface PricingRule {
  max_cost: number;
  margin_pct: number;
}

function calculateSellPrice(
  cost: number,
  rules: PricingRule[],
  settings: { fixed_fee: number; platform_pct: number },
): number {
  const adjustedCost = cost * (1 + KINGUIN_MARKUP);
  const sorted = [...rules].sort((a, b) => a.max_cost - b.max_cost);
  let margin = 0.04;
  for (const rule of sorted) {
    if (adjustedCost <= rule.max_cost) { margin = rule.margin_pct; break; }
  }
  const raw = (adjustedCost + settings.fixed_fee) / (1 - settings.platform_pct - margin);
  return Math.ceil(raw * 100) / 100;
}

async function fetchLiveKinguin(apiKey: string, kinguinProductId: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${KINGUIN_API}/v2/products/${kinguinProductId}`, {
      headers: { "X-Api-Key": apiKey },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const d = await res.json();
    const price = Number(d.price ?? 0);
    const stock = Number(d.qty ?? d.totalQty ?? 0);
    if (!(price > 0)) return null;
    return { price, stock };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const items: CartItemIn[] = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const offerIds = [...new Set(items.map((i) => i.offerId).filter(Boolean))];

    const [kpRes, apRes, rulesRes, topupRulesRes, settingsRes] = await Promise.all([
      admin.from("kinguin_products")
        .select("id, allowed_product_id, kinguin_product_id, sell_price, kinguin_price, kinguin_stock")
        .in("allowed_product_id", offerIds),
      admin.from("allowed_products").select("id, store, tab_category").in("id", offerIds),
      admin.from("pricing_rules").select("max_cost, margin_pct").order("tier_order"),
      admin.from("pricing_rules_topups").select("max_cost, margin_pct").order("tier_order"),
      admin.from("pricing_settings").select("fixed_fee, platform_pct").eq("id", 1).single(),
    ]);

    const kpByOffer = new Map((kpRes.data ?? []).map((r: any) => [r.allowed_product_id, r]));
    const apByOffer = new Map((apRes.data ?? []).map((r: any) => [r.id, r]));
    const pricingRules = rulesRes.data?.length ? rulesRes.data : [
      { max_cost: 2, margin_pct: 0.10 },
      { max_cost: 50, margin_pct: 0.065 },
      { max_cost: 150, margin_pct: 0.055 },
      { max_cost: 99999, margin_pct: 0.04 },
    ];
    const topupRules = topupRulesRes.data?.length ? topupRulesRes.data : pricingRules;
    const pricingSettings = settingsRes.data || { fixed_fee: 0.50, platform_pct: 0.05 };

    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");

    const results = await Promise.all(items.map(async (item) => {
      const kp = kpByOffer.get(item.offerId);
      // Not a Kinguin-linked item (manual/seller/AliExpress stock) — nothing to verify here.
      if (!kp || !kp.kinguin_product_id) {
        return { offerId: item.offerId, checked: false, priceChanged: false, inStock: true };
      }
      if (!KINGUIN_API_KEY) {
        return { offerId: item.offerId, checked: false, priceChanged: false, inStock: true };
      }

      const live = await fetchLiveKinguin(KINGUIN_API_KEY, kp.kinguin_product_id);
      if (!live) {
        // Kinguin unreachable or no usable data — fail open, don't block checkout
        // on our own connectivity hiccups.
        return { offerId: item.offerId, checked: false, priceChanged: false, inStock: true };
      }

      const ap = apByOffer.get(item.offerId);
      const isTopup = ap && (ap.store === "Top Ups" || ap.store === "Gift Cards" || ap.tab_category === "topups");
      const ruleSet = isTopup ? topupRules : pricingRules;
      const newSellPrice = calculateSellPrice(live.price, ruleSet, pricingSettings);

      const inStock = live.stock >= item.quantity;
      const priceChanged = Math.abs(newSellPrice - item.price) > PRICE_TOLERANCE_EUR;

      // Refresh our cache regardless of outcome — this is effectively a free,
      // targeted top-up of the 5-hour cron for whatever the customer is
      // actually looking at right now.
      await admin.from("kinguin_products").update({
        kinguin_price: live.price,
        kinguin_stock: live.stock,
        sell_price: newSellPrice,
        is_active: live.stock > 0,
        last_stock_check: new Date().toISOString(),
        ...(priceChanged || inStock !== (kp.kinguin_stock > 0) ? {
          last_change_summary: priceChanged
            ? `price €${Number(kp.sell_price ?? 0).toFixed(2)}→€${newSellPrice.toFixed(2)} (checkout live-check)`
            : "stock change (checkout live-check)",
          last_change_at: new Date().toISOString(),
          last_change_source: "checkout-live-check",
        } : {}),
      }).eq("id", kp.id);

      return {
        offerId: item.offerId,
        checked: true,
        priceChanged,
        oldPrice: item.price,
        newPrice: newSellPrice,
        inStock,
        availableQty: live.stock,
      };
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("verify-cart-live error:", e);
    // Fail open — never let an internal error here block checkout entirely.
    return new Response(JSON.stringify({ results: [], error: String(e?.message ?? e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
