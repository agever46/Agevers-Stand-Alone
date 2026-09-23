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

    // Get the partial_kinguin products with their current data
    const { data: products } = await supabase
      .from("allowed_products")
      .select("id, title, store, tab_category, developers, publishers, release_date, system_requirements, languages, badges")
      .in("id", productIds);

    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ enriched: 0, skipped: productIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let enriched = 0;
    let errors = 0;
    let skipped = 0;

    for (const product of products) {
      try {
        // Determine which fields are missing
        const missingDevs = !product.developers || product.developers.length === 0;
        const missingPubs = !product.publishers || product.publishers.length === 0;
        const missingRelease = !product.release_date;
        const missingSysReq = !product.system_requirements;

        // If nothing is missing, skip
        if (!missingDevs && !missingPubs && !missingRelease && !missingSysReq) {
          skipped++;
          continue;
        }

        // Extract base game name (remove platform/region suffixes)
        const baseTitle = extractBaseTitle(product.title);
        if (!baseTitle || baseTitle.length < 3) {
          skipped++;
          continue;
        }

        // Search Kinguin API for this game title
        const searchUrl = `${KINGUIN_API}/products?name=${encodeURIComponent(baseTitle)}&limit=20`;
        const res = await fetch(searchUrl, {
          headers: { "X-Api-Key": KINGUIN_API_KEY.trim(), Accept: "application/json" },
        });

        if (!res.ok) {
          errors++;
          continue;
        }

        const data = await res.json();
        const results = data.results || [];

        if (results.length === 0) {
          skipped++;
          continue;
        }

        // Find a sibling product that has the missing data
        let bestMatch: Record<string, unknown> | null = null;
        for (const r of results) {
          const hasDevs = Array.isArray(r.developers) && r.developers.length > 0;
          const hasPubs = Array.isArray(r.publishers) && r.publishers.length > 0;
          const hasRelease = !!r.releaseDate;
          const hasSysReq = Array.isArray(r.systemRequirements) && r.systemRequirements.length > 0;

          // Score how many missing fields this sibling can fill
          let score = 0;
          if (missingDevs && hasDevs) score++;
          if (missingPubs && hasPubs) score++;
          if (missingRelease && hasRelease) score++;
          if (missingSysReq && hasSysReq) score++;

          if (score > 0 && (!bestMatch || score > (bestMatch._score as number))) {
            bestMatch = { ...r, _score: score };
          }
        }

        if (!bestMatch) {
          skipped++;
          continue;
        }

        // Build update with only the missing fields
        const updateData: Record<string, unknown> = {};

        if (missingDevs && Array.isArray(bestMatch.developers) && (bestMatch.developers as string[]).length > 0) {
          updateData.developers = bestMatch.developers;
        }
        if (missingPubs && Array.isArray(bestMatch.publishers) && (bestMatch.publishers as string[]).length > 0) {
          updateData.publishers = bestMatch.publishers;
        }
        if (missingRelease && bestMatch.releaseDate) {
          updateData.release_date = bestMatch.releaseDate;
        }
        if (missingSysReq && Array.isArray(bestMatch.systemRequirements) && (bestMatch.systemRequirements as unknown[]).length > 0) {
          const sysReqs = bestMatch.systemRequirements as Array<{ system?: string; requirement?: string }>;
          const minR = sysReqs.find((r) => r.system === "pc" && r.requirement === "minimum");
          const recR = sysReqs.find((r) => r.system === "pc" && r.requirement === "recommended");
          if (minR || recR) {
            const sysReq: Record<string, unknown> = {};
            if (minR) sysReq.minimum = minR;
            if (recR) sysReq.recommended = recR;
            updateData.system_requirements = sysReq;
          }
        }

        if (Object.keys(updateData).length === 0) {
          skipped++;
          continue;
        }

        // Check if now "full" after enrichment
        const nonGame = isNonGameProduct(product.store || "", product.tab_category);
        const willHaveDevs = !missingDevs || !!updateData.developers;
        const willHavePubs = !missingPubs || !!updateData.publishers;
        const willHaveBadges = product.badges && product.badges.length > 0;
        const willHaveLangs = product.languages && product.languages.length > 0;
        const hasAllFields = nonGame || (willHaveDevs && willHavePubs && willHaveBadges && willHaveLangs);
        updateData.metadata_sync_status = hasAllFields ? "full" : "partial_kinguin";

        const { error: updateError } = await supabase
          .from("allowed_products")
          .update(updateData)
          .eq("id", product.id);

        if (updateError) {
          errors++;
        } else {
          enriched++;
        }

        // Rate limit
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ enriched, errors, skipped, total: products.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Extract the base game title by removing platform/store/region suffixes.
 * e.g. "Renowned Explorers: International Society GOG - PC - Global" → "Renowned Explorers: International Society"
 */
function extractBaseTitle(title: string): string {
  // Remove common trailing patterns like "- PC - Global", "Steam - PC - Europe", etc.
  let base = title
    .replace(/\s*-\s*(PC|Xbox|PlayStation|Nintendo|Mac|Linux)\s*-\s*\w+$/i, "")
    .replace(/\s+(Steam|GOG|Epic Games|Ubisoft|Origin|Battle\.net|Rockstar|Nintendo eShop|Xbox Live|PlayStation Network|Windows Store|Top Ups|Gift Cards)\s*$/i, "")
    .replace(/\s+(Steam|GOG|Epic Games|Ubisoft|Origin|Battle\.net|Rockstar|Nintendo eShop|Xbox Live|PlayStation Network|Windows Store)\s*-\s*/i, "")
    .trim();

  // Remove trailing " - Other - " style suffixes
  base = base.replace(/\s*-\s*Other\s*-\s*.*$/i, "").trim();

  // If we stripped too much, fall back
  if (base.length < 3) return title;
  return base;
}
