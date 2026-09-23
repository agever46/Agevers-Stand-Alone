import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Approximate EUR FX rates (used only to compute card face value in EUR for the report)
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

const KEYWORDS = [
  "gift card", "network card", "psn", "xbox", "steam wallet", "google play",
  "itunes", "app store", "nintendo eshop", "amazon", "razer gold", "netflix card",
  "spotify", "roblox", "minecoins",
];

interface ParsedCard {
  faceValue: number;
  faceCcy: string;
}

function parseFace(title: string): ParsedCard | null {
  // Pattern: "<number> <CCY>"  e.g. "30 EUR", "150 ZAR", "100 PLN"
  const m1 = title.match(/(\d+(?:[.,]\d+)?)\s*(EUR|USD|GBP|HKD|ZAR|HUF|AUD|CZK|PLN|TRY|BRL|MXN|CAD|JPY|KRW|TWD|SGD|AED|SAR|CHF|SEK|NOK|DKK|RUB|ILS|NZD|INR|THB|PHP|IDR|MYR|VND|RON|BGN|HRK)\b/i);
  if (m1) {
    return { faceValue: parseFloat(m1[1].replace(",", ".")), faceCcy: m1[2].toUpperCase() };
  }
  // Pattern: "<symbol><number>"  e.g. "$15", "€50", "£10"
  const m2 = title.match(/([\$£€¥])\s*(\d+(?:[.,]\d+)?)/);
  if (m2) {
    return { faceValue: parseFloat(m2[2].replace(",", ".")), faceCcy: SYMBOL_CCY[m2[1]] || "USD" };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ---- Auth: must be an admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const minRatio: number = Number(body?.minRatio ?? 1.05);
    const onlyActive: boolean = body?.onlyActive ?? true;

    // Safety net: products already marked as overpriced must stay disabled even if
    // a stock/webhook sync accidentally reactivated them before this scan.
    let reDisabled = 0;
    if (onlyActive) {
      const { count, error: countErr } = await admin
        .from("kinguin_products")
        .select("id", { count: "exact", head: true })
        .eq("is_overpriced", true)
        .eq("is_active", true);
      if (countErr) throw countErr;
      reDisabled = count ?? 0;
      if (reDisabled > 0) {
        const { error: updateErr } = await admin
          .from("kinguin_products")
          .update({
            is_active: false,
            last_change_summary: "deactivated (overpriced flag)",
            last_change_at: new Date().toISOString(),
            last_change_source: "overpriced-scan",
          })
          .eq("is_overpriced", true)
          .eq("is_active", true);
        if (updateErr) throw updateErr;
      }
    }

    // ---- Pull all gift-card-like products via title keywords
    // Use OR ilike with all keywords
    const orExpr = KEYWORDS.map((k) => `title.ilike.%${k}%`).join(",");

    // Paginate allowed_products (PostgREST caps at 1000 per request)
    const allowed: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("allowed_products")
        .select("id, title")
        .or(orExpr)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allowed.push(...data);
      if (data.length < PAGE) break;
    }

    const ids = allowed.map((a: any) => a.id);
    if (ids.length === 0) {
      return new Response(JSON.stringify({ scanned: 0, inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch kinguin offers for those ids (batched 100 to avoid URL length limits)
    const offers: any[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      let q = admin
        .from("kinguin_products")
        .select("id, allowed_product_id, sell_price, kinguin_price, kinguin_stock, is_active, is_overpriced")
        .in("allowed_product_id", batch);
      if (onlyActive) q = q.eq("is_active", true).eq("is_overpriced", false);
      const { data, error } = await q;
      if (error) throw error;
      offers.push(...(data ?? []));
    }

    const titleMap = new Map<string, string>();
    allowed.forEach((a: any) => titleMap.set(a.id, a.title));

    const batchId = crypto.randomUUID();
    const rows: any[] = [];

    for (const off of offers) {
      const title = titleMap.get(off.allowed_product_id);
      if (!title) continue;
      const parsed = parseFace(title);
      if (!parsed) continue;
      const rate = FX[parsed.faceCcy];
      if (!rate) continue;
      const faceEur = parsed.faceValue * rate;
      if (faceEur <= 0) continue;
      const sell = Number(off.sell_price ?? 0);
      if (sell <= 0) continue;
      const ratio = sell / faceEur;
      if (ratio < minRatio) continue;

      rows.push({
        scan_batch_id: batchId,
        product_id: off.allowed_product_id,
        kinguin_product_row_id: off.id,
        title,
        sell_price: sell,
        kinguin_price: off.kinguin_price,
        kinguin_stock: off.kinguin_stock,
        face_value: parsed.faceValue,
        face_currency: parsed.faceCcy,
        face_value_eur: Number(faceEur.toFixed(4)),
        sell_vs_face_ratio: Number(ratio.toFixed(4)),
        is_active: off.is_active,
      });
    }

    // Replace previous scan results (one report at a time keeps the UI simple)
    await admin.from("overpriced_card_scans").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    if (rows.length > 0) {
      // Insert in chunks of 500 to avoid payload limits
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await admin
          .from("overpriced_card_scans")
          .insert(rows.slice(i, i + 500));
        if (error) throw error;
      }
    }

    return new Response(JSON.stringify({
      scanned: offers.length,
      inserted: rows.length,
      re_disabled: reDisabled,
      batch_id: batchId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-overpriced-cards error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});