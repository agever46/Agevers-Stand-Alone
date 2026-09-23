import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KINGUIN_API = "https://gateway.kinguin.net/esa/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!KINGUIN_API_KEY) throw new Error("KINGUIN_API_KEY not configured");

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userId: string | null = null;
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      const { data: userData, error: userError } = await adminClient.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id;
    } else {
      userId = claimsData.claims.sub as string;
    }

    const { data: roleRows } = await adminClient
      .from("user_roles").select("role").eq("user_id", userId)
      .in("role", ["admin", "super_admin"]);
    if (!roleRows?.length) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "missing"; // "missing" or "all"
    const limitParam = parseInt(url.searchParams.get("limit") || "100");

    // Get kinguin products that need steam IDs
    let query = adminClient
      .from("kinguin_products")
      .select("allowed_product_id, kinguin_product_id")
      .eq("is_active", true)
      .limit(limitParam);

    const { data: kinguinProducts, error: kpError } = await query;
    if (kpError) throw new Error(kpError.message);
    if (!kinguinProducts?.length) {
      return new Response(JSON.stringify({ success: true, updated: 0, message: "No kinguin products found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If mode=missing, filter to only products without steam_app_id
    let productIds = kinguinProducts.map((kp: any) => kp.allowed_product_id);
    
    if (mode === "missing") {
      const { data: existing } = await adminClient
        .from("allowed_products")
        .select("id, steam_app_id")
        .in("id", productIds);
      
      const missingIds = new Set(
        (existing || []).filter((p: any) => !p.steam_app_id).map((p: any) => p.id)
      );
      productIds = productIds.filter((id: string) => missingIds.has(id));
    }

    if (!productIds.length) {
      return new Response(JSON.stringify({ success: true, updated: 0, message: "All products already have Steam IDs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build map of allowed_product_id -> kinguin_product_id
    const idMap: Record<string, string> = {};
    for (const kp of kinguinProducts) {
      if (productIds.includes(kp.allowed_product_id)) {
        idMap[kp.allowed_product_id] = kp.kinguin_product_id;
      }
    }

    const kinguinIds = Object.values(idMap);
    let updated = 0;
    let errors = 0;

    // Fetch from Kinguin API in batches of 20
    const BATCH = 20;
    for (let i = 0; i < kinguinIds.length; i += BATCH) {
      const batch = kinguinIds.slice(i, i + BATCH);
      
      const results = await Promise.allSettled(
        batch.map(async (kinguinId) => {
          const res = await fetch(`${KINGUIN_API}/products/${kinguinId}`, {
            headers: { "X-Api-Key": KINGUIN_API_KEY.trim(), Accept: "application/json" },
          });
          if (!res.ok) return null;
          const data = await res.json();
          return { kinguinId, steam: data.steam };
        })
      );

      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value?.steam) {
          errors++;
          continue;
        }
        
        const { kinguinId, steam } = result.value;
        const steamAppId = String(steam);
        
        // Find allowed_product_id for this kinguin_product_id
        const allowedId = Object.entries(idMap).find(([_, kid]) => kid === kinguinId)?.[0];
        if (!allowedId) continue;

        const { error: updateError } = await adminClient
          .from("allowed_products")
          .update({ steam_app_id: steamAppId })
          .eq("id", allowedId);

        if (updateError) {
          errors++;
          console.error(`Failed to update ${allowedId}:`, updateError.message);
        } else {
          updated++;
        }
      }

      // Rate limit
      if (i + BATCH < kinguinIds.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      updated,
      errors,
      total: kinguinIds.length,
      message: `Updated ${updated} Steam IDs (${errors} errors)`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Steam ID sync error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
