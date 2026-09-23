// Re-checks gift cards previously disabled as "overpriced".
// Kinguin prices move constantly — a card that was overpriced last month can
// become fairly priced today. This function re-fetches the live Kinguin price
// for flagged cards, recomputes our sell price, and reports (or auto-restores)
// the ones that now fall inside their tier's markup cap.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAdminOrService, requireServiceOrInternal } from "../_shared/adminAuth.ts";

const KINGUIN_API = "https://gateway.kinguin.net/esa/api";
const KINGUIN_MARKUP = 0.0735;

const FX: Record<string, number> = {
  EUR: 1.0, USD: 0.92, GBP: 1.17, HKD: 0.118, ZAR: 0.050,
  HUF: 0.0025, AUD: 0.60, CZK: 0.040, PLN: 0.23, TRY: 0.028,
  BRL: 0.17, MXN: 0.050, CAD: 0.67, JPY: 0.0061, KRW: 0.00067,
  TWD: 0.029, SGD: 0.68, AED: 0.25, SAR: 0.24, CHF: 1.05,
  SEK: 0.087, NOK: 0.087, DKK: 0.134, RUB: 0.010, ILS: 0.25,
  NZD: 0.55, INR: 0.011, THB: 0.026, PHP: 0.016, IDR: 0.000058,
  MYR: 0.20, VND: 0.000036, RON: 0.20, BGN: 0.51, HRK: 0.13,
};
const SYMBOL_CCY: Record<string, string> = { "$": "USD", "£": "GBP", "€": "EUR", "¥": "JPY" };

const TIERS = [
  { maxFaceEur: 5, maxMarkupPct: 40, label: "≤ €5" },
  { maxFaceEur: 10, maxMarkupPct: 30, label: "€5–€10" },
  { maxFaceEur: 25, maxMarkupPct: 20, label: "€10–€25" },
  { maxFaceEur: 50, maxMarkupPct: 15, label: "€25–€50" },
  { maxFaceEur: 100, maxMarkupPct: 10, label: "€50–€100" },
  { maxFaceEur: Infinity, maxMarkupPct: 7, label: "> €100" },
];
const tierFor = (faceEur: number) => TIERS.find((t) => faceEur <= t.maxFaceEur) ?? TIERS[TIERS.length - 1];

function parseFace(title: string): { faceValue: number; faceCcy: string } | null {
  const m1 = title.match(/(\d+(?:[.,]\d+)?)\s*(EUR|USD|GBP|HKD|ZAR|HUF|AUD|CZK|PLN|TRY|BRL|MXN|CAD|JPY|KRW|TWD|SGD|AED|SAR|CHF|SEK|NOK|DKK|RUB|ILS|NZD|INR|THB|PHP|IDR|MYR|VND|RON|BGN|HRK)\b/i);
  if (m1) return { faceValue: parseFloat(m1[1].replace(",", ".")), faceCcy: m1[2].toUpperCase() };
  const m2 = title.match(/([\$£€¥])\s*(\d+(?:[.,]\d+)?)/);
  if (m2) return { faceValue: parseFloat(m2[2].replace(",", ".")), faceCcy: SYMBOL_CCY[m2[1]] || "USD" };
  return null;
}

function calcSellPrice(
  cost: number,
  rules: { max_cost: number; margin_pct: number }[],
  settings: { fixed_fee: number; platform_pct: number },
): number {
  const adjusted = cost * (1 + KINGUIN_MARKUP);
  const sorted = [...rules].sort((a, b) => a.max_cost - b.max_cost);
  let margin = 0.04;
  for (const r of sorted) if (adjusted <= r.max_cost) { margin = r.margin_pct; break; }
  const raw = (adjusted + settings.fixed_fee) / (1 - settings.platform_pct - margin);
  return Math.ceil(raw * 100) / 100;
}

async function fetchKinguinPrice(apiKey: string, productId: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${KINGUIN_API}/v2/products/${productId}`, {
      headers: { "X-Api-Key": apiKey },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const d = await res.json();
    return { price: Number(d.price ?? 0), stock: Number(d.qty ?? d.totalQty ?? 0) };
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Admin from the dashboard, or the nightly cron via the internal token.
  const internalOk = await requireServiceOrInternal(req, corsHeaders) === null;
  if (!internalOk) {
    const denied = await requireAdminOrService(req, corsHeaders);
    if (denied) return denied;
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");
    if (!KINGUIN_API_KEY) throw new Error("KINGUIN_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const limit: number = Math.min(Number(body?.limit ?? 200), 500);
    const autoApply: boolean = body?.autoApply === true;

    // Oldest-checked flagged cards first, so repeated runs sweep the whole set.
    const { data: flagged, error: flagErr } = await admin
      .from("kinguin_products")
      .select("id, kinguin_product_id, allowed_product_id, kinguin_price, sell_price, kinguin_stock, last_stock_check")
      .eq("is_overpriced", true)
      .order("last_stock_check", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (flagErr) throw flagErr;

    const rows = flagged ?? [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ checked: 0, recovered: [], applied: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Titles
    const apIds = [...new Set(rows.map((r: any) => r.allowed_product_id).filter(Boolean))];
    const titleMap = new Map<string, string>();
    for (let i = 0; i < apIds.length; i += 200) {
      const { data } = await admin
        .from("allowed_products")
        .select("id, title")
        .in("id", apIds.slice(i, i + 200));
      (data ?? []).forEach((a: any) => titleMap.set(a.id, a.title));
    }

    // Pricing config (gift cards use the top-ups ruleset)
    const [topupRes, rulesRes, settingsRes] = await Promise.all([
      admin.from("pricing_rules_topups").select("max_cost, margin_pct").order("tier_order"),
      admin.from("pricing_rules").select("max_cost, margin_pct").order("tier_order"),
      admin.from("pricing_settings").select("fixed_fee, platform_pct").eq("id", 1).single(),
    ]);
    const baseRules = rulesRes.data?.length ? rulesRes.data : [
      { max_cost: 2, margin_pct: 0.10 },
      { max_cost: 50, margin_pct: 0.065 },
      { max_cost: 150, margin_pct: 0.055 },
      { max_cost: 99999, margin_pct: 0.04 },
    ];
    const ruleSet = topupRes.data?.length ? topupRes.data : baseRules;
    const settings = settingsRes.data || { fixed_fee: 0.50, platform_pct: 0.05 };

    const recovered: any[] = [];
    let checked = 0;
    let applied = 0;
    const nowIso = new Date().toISOString();

    // Modest concurrency to stay friendly with the Kinguin gateway.
    const CONC = 6;
    for (let i = 0; i < rows.length; i += CONC) {
      const slice = rows.slice(i, i + CONC);
      const results = await Promise.all(
        slice.map(async (row: any) => ({ row, live: await fetchKinguinPrice(KINGUIN_API_KEY, String(row.kinguin_product_id)) })),
      );

      for (const { row, live } of results) {
        checked++;
        if (!live || !(live.price > 0)) {
          // Still stamp the row so repeated sweeps keep advancing instead of
          // re-picking the same unreachable products forever.
          await admin.from("kinguin_products").update({ last_stock_check: nowIso }).eq("id", row.id);
          continue;
        }

        const title = titleMap.get(row.allowed_product_id) ?? "";
        const parsed = title ? parseFace(title) : null;
        const rate = parsed ? FX[parsed.faceCcy] : undefined;
        const faceEur = parsed && rate ? parsed.faceValue * rate : 0;

        const newSell = calcSellPrice(live.price, ruleSet, settings);

        // Keep stored numbers fresh even when the card stays overpriced,
        // so the admin table reflects reality.
        const update: Record<string, unknown> = {
          kinguin_price: live.price,
          kinguin_stock: live.stock,
          sell_price: newSell,
          last_stock_check: nowIso,
        };

        if (faceEur > 0) {
          const markupPct = (newSell / faceEur - 1) * 100;
          const tier = tierFor(faceEur);
          if (markupPct <= tier.maxMarkupPct) {
            recovered.push({
              id: row.id,
              allowed_product_id: row.allowed_product_id,
              kinguin_product_id: row.kinguin_product_id,
              title,
              old_sell_price: Number(row.sell_price ?? 0),
              new_sell_price: newSell,
              kinguin_price: live.price,
              kinguin_stock: live.stock,
              face_value: parsed!.faceValue,
              face_currency: parsed!.faceCcy,
              face_value_eur: Number(faceEur.toFixed(4)),
              markup_pct: Number(markupPct.toFixed(2)),
              cap_pct: tier.maxMarkupPct,
              tier_label: tier.label,
            });
            if (autoApply) {
              update.is_overpriced = false;
              update.overpriced_marked_at = null;
              update.is_active = live.stock > 0;
              update.last_change_summary = `price dropped — no longer overpriced (+${markupPct.toFixed(1)}% ≤ +${tier.maxMarkupPct}%)`;
              update.last_change_at = nowIso;
              update.last_change_source = "overpriced-recheck";
              applied++;
            }
          }
        }

        await admin.from("kinguin_products").update(update).eq("id", row.id);
      }
    }

    return new Response(JSON.stringify({ checked, recovered, applied, auto_applied: autoApply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("recheck-overpriced-cards error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
