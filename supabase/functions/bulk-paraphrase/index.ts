import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KINGUIN_API_KEY) throw new Error("KINGUIN_API_KEY not configured");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");
    const { data: roleRows } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "super_admin"]);
    if (!roleRows || roleRows.length === 0) throw new Error("Admin access required");

    const { batchSize = 10 } = await req.json().catch(() => ({}));
    const KINGUIN_API = "https://gateway.kinguin.net/esa/api/v1";

    // Get allowed_products without descriptions, joined with kinguin_products
    const { data: apWithout, error: apErr } = await supabase
      .from("allowed_products")
      .select("id, title, kinguin_products(kinguin_product_id)")
      .is("description", null)
      .limit(batchSize);

    if (apErr) throw apErr;
    if (!apWithout?.length) {
      return new Response(JSON.stringify({ message: "All products already have descriptions", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${apWithout.length} products needing descriptions`);

    let processed = 0;
    let failed = 0;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    for (const product of apWithout) {
      try {
        const kp = (product as any).kinguin_products;
        const kinguinId = kp?.kinguin_product_id;

        let originalDesc: string | null = null;

        if (kinguinId) {
          // Fetch directly by product ID
          const kRes = await fetch(`${KINGUIN_API}/products/${kinguinId}`, {
            headers: { "X-Api-Key": KINGUIN_API_KEY.trim(), Accept: "application/json" },
          });
          if (kRes.ok) {
            const kData = await kRes.json();
            originalDesc = kData.description || null;
          }
        }

        if (!originalDesc) {
          // Fallback: search by name
          const searchName = encodeURIComponent(product.title.substring(0, 50));
          const kRes = await fetch(`${KINGUIN_API}/products?name=${searchName}&limit=1`, {
            headers: { "X-Api-Key": KINGUIN_API_KEY.trim(), Accept: "application/json" },
          });
          if (kRes.ok) {
            const kData = await kRes.json();
            originalDesc = kData.results?.[0]?.description || null;
          }
        }

        if (!originalDesc) {
          console.log(`No description from Kinguin for ${product.title}`);
          await supabase.from("allowed_products").update({ description: "" }).eq("id", product.id);
          processed++;
          continue;
        }

        // Paraphrase
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-lite",
            messages: [
              { role: "system", content: `You are a professional game store copywriter. Rewrite the following product description in your own words. Rules: Keep the same information and key features, use different sentence structures and vocabulary, make it sound professional and appealing, do NOT mention "Kinguin" or any marketplace name, keep it concise (max 3-4 paragraphs), write in English, output the description directly without prefixes. CRITICAL: If this is a bundle/edition/pack that includes specific items, DLCs, expansions, skins, maps, or any listed contents — you MUST preserve and list ALL included items exactly. Never omit, summarize, or generalize the bundle contents.` },
              { role: "user", content: `Product: "${product.title}"\n\nOriginal:\n${originalDesc}` },
            ],
            temperature: 0.8,
            max_tokens: 800,
          }),
        });

        if (!aiRes.ok) {
          console.error(`AI failed for ${product.title}: ${aiRes.status}`);
          failed++;
          continue;
        }

        const aiData = await aiRes.json();
        const paraphrased = aiData.choices?.[0]?.message?.content?.trim();

        if (paraphrased) {
          await supabase.from("allowed_products").update({ description: paraphrased }).eq("id", product.id);
          console.log(`Updated: ${product.title}`);
          processed++;
        } else {
          failed++;
        }

        // Small delay to avoid rate limits
        await delay(1000);
      } catch (e) {
        console.error(`Error processing:`, e);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed, failed, total: apWithout.length }), {
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
