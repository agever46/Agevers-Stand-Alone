import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.1";
import { requireServiceOrInternal } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 5;
const AI_TIMEOUT_MS = 35_000;

const AiBatchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      description: z.string().min(20),
    })
  ),
});

const extractAiItems = (aiData: any) => {
  const toolArgs = aiData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (toolArgs) {
    return AiBatchSchema.parse(JSON.parse(toolArgs)).items;
  }
  const content = aiData?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("empty_response");
  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) {
    return z.array(AiBatchSchema.shape.items.element).parse(parsed);
  }
  return AiBatchSchema.parse(parsed).items;
};

const ensureParagraphs = (text: string): string => {
  if (text.includes("\n\n")) return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 3) return text;
  const chunkSize = Math.ceil(sentences.length / 3);
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += chunkSize) {
    paragraphs.push(sentences.slice(i, i + chunkSize).join(" "));
  }
  return paragraphs.join("\n\n");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = await requireServiceOrInternal(req, corsHeaders);
  if (authFail) return authFail;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let lockedProductIds: string[] = [];

  try {
    // Step 0: Reset stuck items (>15 min in processing)
    try {
      const { data: resetCount, error: resetErr } = await supabase.rpc("reset_stuck_paraphrasing");
      if (resetErr) console.warn("Reset stuck error:", resetErr.message);
      else if (resetCount && resetCount > 0) console.log(`Reset ${resetCount} stuck items`);
    } catch (e) {
      console.warn("Reset stuck exception:", e);
    }

    // Step 1: Fetch 50 idle products with descriptions
    const { data: products, error: fetchErr } = await supabase
      .from("allowed_products")
      .select("id, title, description")
      .eq("paraphrase_status", "idle")
      .eq("description_paraphrased", false)
      .not("description", "is", null)
      .neq("description", "")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;
    if (!products || products.length === 0) {
      console.log("No idle products to paraphrase");
      return new Response(JSON.stringify({ processed: 0, message: "No idle products" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productIds = products.map((p) => p.id);
    lockedProductIds = productIds;
    console.log(`Processing ${products.length} products`);

    // Step 2: Atomically mark as processing
    const { error: lockErr } = await supabase
      .from("allowed_products")
      .update({ paraphrase_status: "processing", paraphrase_locked_at: new Date().toISOString() } as any)
      .in("id", productIds)
      .eq("paraphrase_status", "idle");

    if (lockErr) throw lockErr;

    // Step 3: Single AI request for the whole batch
    const SYS_PROMPT = `You are a premium game store SEO copywriter for Agever's. Create unique, high-quality product descriptions optimized for Google search.

STRUCTURE (180-250 words, 3-4 paragraphs):

**Paragraph 1 — Hook & Overview:**
- Start each product with a DIFFERENT opening style. Vary between: a question, a bold statement, a scenario, a comparison, a superlative claim, or a genre insight. NEVER start two products the same way.
- Naturally weave in search phrases like "buy [product name]" or "cheap [product name] key" or "[product name] instant delivery" — they must flow as natural prose, NOT as a keyword list.
- Mention the platform and what the buyer gets (digital key, instant delivery).

**Paragraph 2 — Features & Gameplay:**
- Highlight 3-5 key features using different vocabulary and sentence structures for each product.
- Focus on what makes THIS product unique (RPG depth, action intensity, story richness, multiplayer, open world, etc.).
- Preserve ALL bundle/DLC/edition contents exactly if applicable.

**Paragraph 3 — Who Should Play This? (MANDATORY):**
- Header: "Who Should Play This?"
- Describe the ideal buyer persona: what kind of gamer, what they enjoy, why they'd love this.
- Include a compelling reason people buy it (value, nostalgia, competitive edge, story experience).
- This section MASSIVELY boosts SEO — make it detailed and genuine.

RULES:
- English only. No marketplace names (Kinguin, G2A, Eneba, etc.).
- Each product MUST have a unique opening, unique phrasing, and unique focus angle.
- Output descriptions directly without prefixes or labels.
- Return results only via the paraphrase_batch tool.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        temperature: 0.4,
        messages: [
          { role: "system", content: SYS_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              instruction: "Paraphrase all products and return one JSON result for the entire batch.",
              products,
            }),
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "paraphrase_batch",
              description: "Return the paraphrased descriptions for the full batch of products.",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["id", "description"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "paraphrase_batch" } },
      }),
    });

    clearTimeout(timeout);

    // On rate limit or credits exhausted, reset to idle and exit
    if (aiRes.status === 429 || aiRes.status === 402) {
      console.warn(`AI returned ${aiRes.status}, resetting batch to idle`);
      await supabase
        .from("allowed_products")
        .update({ paraphrase_status: "idle" })
        .in("id", productIds);
      return new Response(
        JSON.stringify({ processed: 0, error: aiRes.status === 429 ? "rate_limited" : "credits_exhausted" }),
        { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      console.error("AI error:", aiRes.status, errorText);
      await supabase
        .from("allowed_products")
        .update({ paraphrase_status: "idle" })
        .in("id", productIds);
      throw new Error(`ai_${aiRes.status}`);
    }

    // Step 4: Parse and update
    const aiData = await aiRes.json();
    const aiItems = extractAiItems(aiData);
    const requestedIds = new Set(productIds);

    const successful = aiItems.filter((item) => requestedIds.has(item.id) && item.description.trim().length > 20);

    let updated = 0;
    if (successful.length > 0) {
      const results = await Promise.all(
        successful.map((item) =>
          supabase
            .from("allowed_products")
            .update({
              description: ensureParagraphs(item.description),
              description_paraphrased: true,
              paraphrase_status: "completed",
            })
            .eq("id", item.id)
        )
      );
      updated = results.filter((r) => !r.error).length;
    }

    // Reset any that weren't successfully updated back to idle
    const updatedIds = new Set(successful.map((i) => i.id));
    const failedIds = productIds.filter((id) => !updatedIds.has(id));
    if (failedIds.length > 0) {
      await supabase
        .from("allowed_products")
        .update({ paraphrase_status: "idle" })
        .in("id", failedIds);
    }

    console.log(`Done: ${updated} updated, ${failedIds.length} reset to idle`);

    return new Response(
      JSON.stringify({ processed: updated, failed: failedIds.length, total: products.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("cron-paraphrase error:", message);
    if (error instanceof Error && error.stack) {
      console.error("Stack:", error.stack);
    }
    if (lockedProductIds.length > 0) {
      await supabase
        .from("allowed_products")
        .update({ paraphrase_status: "idle" })
        .in("id", lockedProductIds);
    }
    return new Response(JSON.stringify({ error: message }), {
      status: error instanceof Error && error.name === "AbortError" ? 504 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
