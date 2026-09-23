import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KINGUIN_API = "https://gateway.kinguin.net/esa/api/v1";

const NON_GAME_STORES = new Set([
  "gift cards", "top ups", "subscriptions", "in-game items",
  "gaming accessories", "media & streaming",
]);

function isNonGameProduct(store: string, tabCategory: string | null): boolean {
  return NON_GAME_STORES.has(store.toLowerCase()) || tabCategory === "topups";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authFail = await requireAdminOrService(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");
    if (!KINGUIN_API_KEY) throw new Error("KINGUIN_API_KEY not set");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { productIds } = await req.json();
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      throw new Error("productIds array required");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get kinguin mappings for these products
    const { data: mappings } = await supabase
      .from("kinguin_products")
      .select("allowed_product_id, kinguin_product_id")
      .in("allowed_product_id", productIds);

    // Fetch store/tab_category for all products to determine non-game status
    const { data: productMeta } = await supabase
      .from("allowed_products")
      .select("id, store, tab_category")
      .in("id", productIds);
    const metaMap = new Map((productMeta || []).map(p => [p.id, p]));

    if (!mappings || mappings.length === 0) {
      // No kinguin mapping — mark as partial_kinguin (Kinguin doesn't have these)
      for (let i = 0; i < productIds.length; i += 50) {
        const chunk = productIds.slice(i, i + 50);
        await supabase
          .from("allowed_products")
          .update({ metadata_sync_status: "partial_kinguin" })
          .in("id", chunk);
      }
      return new Response(JSON.stringify({ updated: 0, errors: 0, skipped: productIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark unmapped products as partial_kinguin
    const mappedIds = new Set(mappings.map(m => m.allowed_product_id));
    const unmappedIds = productIds.filter(id => !mappedIds.has(id));
    if (unmappedIds.length > 0) {
      for (let i = 0; i < unmappedIds.length; i += 50) {
        const chunk = unmappedIds.slice(i, i + 50);
        await supabase
          .from("allowed_products")
          .update({ metadata_sync_status: "partial_kinguin" })
          .in("id", chunk);
      }
    }

    let updated = 0;
    let errors = 0;

    for (const mapping of mappings) {
      try {
        const url = `${KINGUIN_API}/products?productId=${mapping.kinguin_product_id}&limit=1`;
        const res = await fetch(url, {
          headers: { "X-Api-Key": KINGUIN_API_KEY.trim(), Accept: "application/json" },
        });

        if (!res.ok) {
          errors++;
          // API error — mark as partial_error (can retry)
          await supabase
            .from("allowed_products")
            .update({ metadata_sync_status: "partial_error" })
            .eq("id", mapping.allowed_product_id);
          continue;
        }

        const data = await res.json();
        const p = data.results?.[0];
        if (!p) {
          // Kinguin returned no data for this product
          await supabase
            .from("allowed_products")
            .update({ metadata_sync_status: "partial_kinguin" })
            .eq("id", mapping.allowed_product_id);
          errors++;
          continue;
        }

        let sysReq = null;
        if (p.systemRequirements && Array.isArray(p.systemRequirements)) {
          const minR = p.systemRequirements.find((r: any) => r.system === "pc" && r.requirement === "minimum");
          const recR = p.systemRequirements.find((r: any) => r.system === "pc" && r.requirement === "recommended");
          if (minR || recR) {
            sysReq = {} as Record<string, unknown>;
            if (minR) sysReq.minimum = minR;
            if (recR) sysReq.recommended = recR;
          }
        }

        const badges = Array.isArray(p.genres) && p.genres.length > 0 ? p.genres : [];
        const developers = Array.isArray(p.developers) ? p.developers : [];
        const publishers = Array.isArray(p.publishers) ? p.publishers : [];
        const languages = Array.isArray(p.languages) ? p.languages : [];

        // Determine if sync is full or partial
        const pm = metaMap.get(mapping.allowed_product_id);
        const nonGame = pm ? isNonGameProduct(pm.store, pm.tab_category) : false;
        const hasAllFields = nonGame || (badges.length > 0 && developers.length > 0 && languages.length > 0);
        const syncStatus = hasAllFields ? "full" : "partial_kinguin";

        const updateData: Record<string, unknown> = {
          developers,
          publishers,
          regional_limitations: p.regionalLimitations || null,
          platform_details: p.platform || null,
          languages,
          release_date: p.releaseDate || null,
          metadata_sync_status: syncStatus,
          ...(sysReq ? { system_requirements: sysReq } : {}),
          ...(badges.length > 0 ? { badges } : {}),
        };

        const { error: updateError } = await supabase
          .from("allowed_products")
          .update(updateData)
          .eq("id", mapping.allowed_product_id);

        if (updateError) {
          errors++;
          await supabase
            .from("allowed_products")
            .update({ metadata_sync_status: "partial_error" })
            .eq("id", mapping.allowed_product_id);
        } else {
          updated++;
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 80));
      } catch {
        errors++;
        await supabase
          .from("allowed_products")
          .update({ metadata_sync_status: "partial_error" })
          .eq("id", mapping.allowed_product_id);
      }
    }

    return new Response(JSON.stringify({ updated, errors, total: mappings.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
