import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Only take 5 items — conservative to avoid rate limits
    const { data: items, error: fetchErr } = await supabase
      .from("paraphrase_queue")
      .select("id, allowed_product_id")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);

    if (fetchErr) throw fetchErr;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "Queue empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as processing
    await supabase
      .from("paraphrase_queue")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .in("id", items.map((i) => i.id));

    // Fetch products
    const productIds = [...new Set(items.map((i) => i.allowed_product_id))];
    const { data: products } = await supabase
      .from("allowed_products")
      .select("id, title, description")
      .in("id", productIds);

    const productMap = new Map((products || []).map((p) => [p.id, p]));

    let processed = 0;
    let failed = 0;

    for (const item of items) {
      const product = productMap.get(item.allowed_product_id);
      if (!product || !product.description) {
        await supabase
          .from("paraphrase_queue")
          .update({ status: "failed", error: "no_description", updated_at: new Date().toISOString() })
          .eq("id", item.id);
        failed++;
        continue;
      }

      // Skip short descriptions — mark done without AI call.
      if (product.description.trim().length < 200) {
        await supabase.from("allowed_products").update({ description_paraphrased: true }).eq("id", product.id);
        await supabase.from("paraphrase_queue").update({ status: "completed", error: "skipped_short", updated_at: new Date().toISOString() }).eq("id", item.id);
        processed++;
        continue;
      }

      let done = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await delay(10000 * attempt);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `Rewrite this game product description in different words. Keep key features. Remove any marketplace names (Kinguin, G2A etc). Max 2-3 short paragraphs. English only. Output only the description. CRITICAL: If this is a bundle/edition/pack that includes specific items, DLCs, expansions, skins, maps, or any listed contents — you MUST preserve and list ALL included items exactly.`,
                },
                {
                  role: "user",
                  content: `"${product.title}"\n\n${product.description}`,
                },
              ],
              temperature: 0.7,
              max_tokens: 400,
            }),
          });

          clearTimeout(timeout);

          if (aiRes.status === 429) {
            console.log(`Rate limited on attempt ${attempt + 1}/3`);
            if (attempt === 2) {
              // Give up on this item, put back to pending
              await supabase
                .from("paraphrase_queue")
                .update({ status: "pending", error: "rate_limited", updated_at: new Date().toISOString() })
                .eq("id", item.id);
              // Put ALL remaining processing items back
              await supabase
                .from("paraphrase_queue")
                .update({ status: "pending", updated_at: new Date().toISOString() })
                .eq("status", "processing");
              const { count } = await supabase
                .from("paraphrase_queue")
                .select("id", { count: "exact", head: true })
                .eq("status", "pending");
              console.log(`Rate limited, stopping. Processed: ${processed}, Failed: ${failed}, Remaining: ${count}`);
              return new Response(
                JSON.stringify({ processed, failed, remaining: count ?? 0, stopped: "rate_limited" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            continue;
          }

          if (aiRes.status === 402) {
            await supabase.from("paraphrase_queue").update({ status: "pending", updated_at: new Date().toISOString() }).eq("status", "processing");
            console.error("Credits exhausted!");
            return new Response(JSON.stringify({ error: "credits_exhausted", processed }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (!aiRes.ok) {
            if (attempt === 2) {
              await supabase.from("paraphrase_queue").update({ status: "failed", error: `ai_${aiRes.status}`, updated_at: new Date().toISOString() }).eq("id", item.id);
              failed++;
              done = true;
            }
            continue;
          }

          const aiData = await aiRes.json();
          const newDesc = aiData.choices?.[0]?.message?.content?.trim();

          if (newDesc) {
            await supabase.from("allowed_products").update({ description: newDesc, description_paraphrased: true }).eq("id", product.id);
            await supabase.from("paraphrase_queue").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", item.id);
            processed++;
          } else {
            await supabase.from("paraphrase_queue").update({ status: "failed", error: "empty_response", updated_at: new Date().toISOString() }).eq("id", item.id);
            failed++;
          }
          done = true;
          break;
        } catch (_e) {
          clearTimeout(timeout);
          if (attempt === 2) {
            await supabase.from("paraphrase_queue").update({ status: "failed", error: "timeout", updated_at: new Date().toISOString() }).eq("id", item.id);
            failed++;
            done = true;
          }
        }
      }

      // 6s between items to spread load
      if (done) await delay(6000);
    }

    const { count } = await supabase
      .from("paraphrase_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    console.log(`Processed: ${processed}, Failed: ${failed}, Remaining: ${count}`);

    return new Response(
      JSON.stringify({ processed, failed, remaining: count ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("process-paraphrase-queue error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
