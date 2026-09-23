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

    const { allowedProductId } = await req.json();
    if (!allowedProductId) throw new Error("allowedProductId required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get kinguin product id
    const { data: kp } = await supabase
      .from("kinguin_products")
      .select("kinguin_product_id")
      .eq("allowed_product_id", allowedProductId)
      .single();

    if (!kp) throw new Error("No kinguin product linked");

    // Fetch from Kinguin API
    const url = `${KINGUIN_API}/products?productId=${kp.kinguin_product_id}&limit=1`;
    const res = await fetch(url, {
      headers: { "X-Api-Key": KINGUIN_API_KEY.trim(), Accept: "application/json" },
    });

    if (!res.ok) throw new Error(`Kinguin API error: ${res.status}`);
    const data = await res.json();
    const product = data.results?.[0];
    if (!product) throw new Error("Product not found on Kinguin");

    // Parse system requirements
    let sysReq = null;
    if (product.systemRequirements && Array.isArray(product.systemRequirements)) {
      const minReq = product.systemRequirements.find((r: any) => r.system === "pc" && r.requirement === "minimum");
      const recReq = product.systemRequirements.find((r: any) => r.system === "pc" && r.requirement === "recommended");
      if (minReq || recReq) {
        sysReq = {};
        if (minReq) sysReq.minimum = minReq;
        if (recReq) sysReq.recommended = recReq;
      }
    }

    // Fetch store/tab_category to determine sync status
    const { data: apMeta } = await supabase
      .from("allowed_products")
      .select("store, tab_category")
      .eq("id", allowedProductId)
      .single();

    const devs = Array.isArray(product.developers) ? product.developers : [];
    const pubs = Array.isArray(product.publishers) ? product.publishers : [];
    const langs = Array.isArray(product.languages) ? product.languages : [];
    const badges = Array.isArray(product.genres) && product.genres.length > 0 ? product.genres : [];

    const nonGame = apMeta ? isNonGameProduct(apMeta.store, apMeta.tab_category) : false;
    const hasAllFields = nonGame || (badges.length > 0 && devs.length > 0 && langs.length > 0);

    const updateData: Record<string, unknown> = {
      developers: devs,
      publishers: pubs,
      regional_limitations: product.regionalLimitations || null,
      platform_details: product.platform || null,
      languages: langs,
      release_date: product.releaseDate || null,
      metadata_sync_status: hasAllFields ? "full" : "partial_kinguin",
      ...(sysReq ? { system_requirements: sysReq } : {}),
      ...(badges.length > 0 ? { badges } : {}),
    };

    const { error: updateError } = await supabase
      .from("allowed_products")
      .update(updateData)
      .eq("id", allowedProductId);

    if (updateError) throw new Error(`Update failed: ${updateError.message}`);

    return new Response(JSON.stringify({ success: true, updated: updateData }), {
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
