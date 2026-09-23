import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireServiceOrInternal } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authFail = await requireServiceOrInternal(req, corsHeaders);
  if (authFail) return authFail;

  // Auth-only canary probe used by cron-health-monitor: confirms the
  // service-role/internal-token header still works without creating a bundle.
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
    // 1. Auto-deactivate bundles older than 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: deactivated } = await supabase
      .from("bundles")
      .update({ is_active: false })
      .lt("created_at", fourteenDaysAgo)
      .eq("is_active", true)
      .select("id");

    console.log(`Deactivated ${deactivated?.length || 0} old bundles`);

    // 2. Fetch in-stock products with kinguin (Global region only - works for everyone)
    const { data: products, error: prodErr } = await supabase
      .from("kinguin_products")
      .select(`
        allowed_product_id,
        kinguin_stock,
        sell_price,
        allowed_products!inner(id, title, image_url, platform, store, region, slug, sold_count)
      `)
      .eq("is_active", true)
      .eq("allowed_products.region", "Global")
      .gt("kinguin_stock", 5)
      .order("kinguin_stock", { ascending: false })
      .limit(80);

    if (prodErr) throw prodErr;
    if (!products || products.length < 3) {
      return new Response(JSON.stringify({ error: "Not enough in-stock products" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing bundle product IDs to avoid repeats
    const { data: existingActive } = await supabase
      .from("bundle_products")
      .select("allowed_product_id, bundles!inner(is_active)")
      .eq("bundles.is_active", true);

    const usedIds = new Set((existingActive || []).map((r: any) => r.allowed_product_id));

    const candidates = products
      .filter((p: any) => !usedIds.has(p.allowed_product_id))
      .map((p: any) => ({
        id: p.allowed_product_id,
        title: p.allowed_products.title,
        platform: p.allowed_products.platform,
        store: p.allowed_products.store,
        price: p.sell_price,
      }));

    if (candidates.length < 3) {
      return new Response(JSON.stringify({ error: "Not enough unused products" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Deterministic theme picking: group by platform+store and pick a group with ≥3 items.
    // No AI calls — themed by shared storefront (e.g., "Steam PC Picks", "PlayStation Store Picks").
    const groups = new Map<string, typeof candidates>();
    for (const c of candidates) {
      const key = `${c.platform || "Other"}|${c.store || ""}`.trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }
    const eligibleGroups = [...groups.entries()].filter(([, arr]) => arr.length >= 3);
    if (eligibleGroups.length === 0) throw new Error("No group with 3+ shared-theme products");

    // Prefer groups with the most candidates but rotate via random tiebreak
    eligibleGroups.sort((a, b) => b[1].length - a[1].length || Math.random() - 0.5);
    const [chosenKey, chosenPool] = eligibleGroups[0];
    const [platformName, storeName] = chosenKey.split("|");
    const chosen = pickRandom(chosenPool, 3);
    const validIds = chosen.map((c) => c.id);

    const themeLabel = storeName ? `${storeName} ${platformName}`.trim() : platformName;
    const bundle_name = `${themeLabel} Picks`.slice(0, 30);
    const description = `Three hand-picked ${themeLabel} titles — bundled at 10% off.`.slice(0, 120);

    // 5. Create bundle
    const baseSlug = slugify(bundle_name) + "-" + Date.now().toString(36);
    const { data: bundle, error: bundleErr } = await supabase
      .from("bundles")
      .insert({
        name: bundle_name,
        slug: baseSlug,
        description,
        discount_type: "percentage",
        discount_value: 10,
        is_active: true,
        display_order: 0,
      })
      .select()
      .single();

    if (bundleErr) throw bundleErr;

    // 6. Link products
    const links = validIds.map((pid: string, idx: number) => ({
      bundle_id: bundle.id,
      allowed_product_id: pid,
      display_order: idx,
    }));

    const { error: linkErr } = await supabase.from("bundle_products").insert(links);
    if (linkErr) throw linkErr;

    return new Response(JSON.stringify({
      success: true,
      bundle_id: bundle.id,
      name: bundle_name,
      products: validIds.length,
      deactivated: deactivated?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-create-bundle error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
